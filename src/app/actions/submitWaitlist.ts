"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface WaitlistSubmissionInput {
  workEmail: string;
  companyName: string;
  dealSizeTier: "under_25k" | "25k_to_100k" | "over_100k";
  currentBottleneck: string;
  complianceFrameworks: string[];
}

export interface WaitlistSubmissionResult {
  success: boolean;
  error?: string;
  leadId?: string;
}

const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
];

/**
 * Public waitlist lead capture: validates business emails, scores lead
 * urgency, persists via service-role (the table has no public RLS policies),
 * and pings the founder webhook for instant follow-up.
 */
export async function submitWaitlistAction(
  data: WaitlistSubmissionInput,
): Promise<WaitlistSubmissionResult> {
  // 1. Enforce business email validation (reject free webmails)
  const domain = data.workEmail.split("@")[1]?.toLowerCase();
  if (!domain || FREE_EMAIL_DOMAINS.includes(domain)) {
    return {
      success: false,
      error: "Please use your official company email address.",
    };
  }

  // 2. Calculate dynamic lead urgency score
  let leadScore = 10;
  if (data.dealSizeTier === "25k_to_100k") leadScore += 30;
  if (data.dealSizeTier === "over_100k") leadScore += 50;
  if (data.complianceFrameworks.includes("SOC 2 Type II")) leadScore += 20;

  // 3. Insert record into database
  const supabaseAdmin = createAdminClient();
  const { data: record, error: insertError } = await supabaseAdmin
    .from("waitlist_leads")
    .insert({
      work_email: data.workEmail,
      company_name: data.companyName,
      company_domain: domain,
      deal_size_tier: data.dealSizeTier,
      current_bottleneck: data.currentBottleneck,
      compliance_frameworks: data.complianceFrameworks,
      lead_score: leadScore,
      status: "new",
    })
    .select("id")
    .single();

  if (insertError || !record) {
    return {
      success: false,
      error: "Unable to process registration. Please try again.",
    };
  }

  // 4. Slack / Discord webhook alert to the founder for instant follow-up
  const webhookUrl = process.env.FOUNDER_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🚨 **High-Priority Waitlist Lead**: ${data.workEmail} (${data.companyName})\nDeal Tier: ${data.dealSizeTier} | Lead Score: ${leadScore}`,
        }),
      });
    } catch {
      // Alert delivery is best-effort; never block the signup
    }
  }

  return { success: true, leadId: record.id };
}
