const { adminClient } = require('./_lib/supabase');

async function auditBranch(admin, branchId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const [{ data: tx }, { data: settings }] = await Promise.all([
    admin
      .from('financial_transactions')
      .select('id, net_amount_kes, transaction_type, category_id, description')
      .eq('branch_id', branchId)
      .eq('is_deleted', false)
      .gte('transaction_date', cutoff),
    admin
      .from('profit_first_settings')
      .select('*')
      .eq('branch_id', branchId)
      .maybeSingle()
  ]);

  const alerts = [];
  let revenue = 0, expenses = 0;

  for (const r of tx || []) {
    const amount = Number(r.net_amount_kes || 0);
    if (r.transaction_type === 'revenue') revenue += amount;
    if (r.transaction_type === 'expense') expenses += amount;

    // Anomaly Check: Flag single transactions exceeding 150,000 KES
    if (amount > 150000) {
      alerts.push({
        branch_id: branchId,
        alert_type: 'anomaly',
        severity: 'high',
        title: 'High-Value Transaction Flagged',
        message: `Transaction of KES ${amount.toLocaleString()} (${r.description || 'No description'}) requires managerial review.`,
        status: 'open'
      });
    }
  }

  // Target Check: Target shortfall evaluation
  if (settings && settings.monthly_revenue_target_kes) {
    const target = Number(settings.monthly_revenue_target_kes);
    if (revenue < target * 0.8) {
      alerts.push({
        branch_id: branchId,
        alert_type: 'target_shortfall',
        severity: 'medium',
        title: 'Monthly Revenue Below 80% Target',
        message: `Trailing 30-day revenue (KES ${revenue.toLocaleString()}) is below the target threshold (KES ${target.toLocaleString()}).`,
        status: 'open'
      });
    }
  }

  if (alerts.length > 0) {
    await admin.from('financial_alerts').insert(alerts);
  }

  return { branch_id: branchId, alerts_generated: alerts.length };
}

exports.handler = async (event, context) => {
  const admin = adminClient();

  try {
    const { data: branches, error } = await admin
      .from('branches')
      .select('id')
      .eq('is_active', true);

    if (error || !branches) {
      console.error('[cron-cfo-audit] Failed to fetch branches:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch branches.' }) };
    }

    const results = await Promise.all(branches.map(b => auditBranch(admin, b.id)));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Nightly CFO audit completed successfully.', results })
    };
  } catch (e) {
    console.error('[cron-cfo-audit error]:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

// Netlify Cron Schedule (Midnight UTC / 3:00 AM EAT)
export const config = {
  schedule: '0 0 * * *'
};