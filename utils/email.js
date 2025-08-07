import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
//dotenv.config({ path: '../.env' });
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use the built-in Gmail service
    auth: {
      user: 'poojithachalla.2004@gmail.com', // Your Gmail address from .env
      pass: 'ptkj ixcf xjtb zqof', // Your App Password from .env
    },
  });
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export async function sendWeeklyReportEmail(userEmail, reportData) {
  
  const { weeklyPerformance, currentHoldings } = reportData;

  // Build the HTML for the day-wise performance table
  const performanceRows = weeklyPerformance.map(day => {
      const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(day.value)}</td>
        </tr>
      `;
  }).join('');

  // Build the HTML for the current holdings table
  const holdingRows = currentHoldings.map(asset => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${asset.name} (${asset.symbol})</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${asset.shares}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(asset.marketValue)}</td>
    </tr>
  `).join('');

  const message = {
    to: userEmail,
    from: {
      name: 'AssetFlow Reports',
      email: 'poojithachalla.2004@gmail.com',
    },
    subject: `Your AssetFlow Portfolio Performance Report`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="background-color: #0d9488; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Portfolio Performance Report</h2>
        </div>
        
        <div style="padding: 25px;">
          <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">7-Day Portfolio Value</h3>
          <p>This chart shows the total value of your portfolio at the end of each day for the past week.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">Date</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">End-of-Day Value</th>
              </tr>
            </thead>
            <tbody>
              ${performanceRows}
            </tbody>
          </table>

          <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">Current Holdings Snapshot</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">Asset</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">Shares</th>
                <th style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">Current Market Value</th>
              </tr>
            </thead>
            <tbody>
              ${holdingRows}
            </tbody>
          </table>
        </div>

        <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0;">This report was generated on demand from the AssetFlow application.</p>
        </div>
      </div>
    `,
  };

  try {
    let info = await transporter.sendMail(message);
    console.log(`Weekly performance report sent successfully to ${userEmail}`);
  } catch (error) {
    console.error('!!! FAILED TO SEND EMAIL VIA SENDGRID !!!');
    if (error.response) console.error('Error Body:', error.response.body);
    throw error;
  }
}

export async function sendLowBalanceWarningEmail(userEmail, currentBalance, threshold) {
    const appUrl = process.env.APP_URL || 'http://127.0.0.1:5500/index.html'; // Fallback for safety

    const message = {
        to: userEmail,
        from: {
            name: 'AssetFlow Alerts',
            email: 'poojithachalla.2004@gmail.com',
        },
        subject: `Low Balance Alert for Your AssetFlow Account`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                <div style="background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0;">Low Balance Alert</h2>
                </div>
                <div style="padding: 25px;">
                    <h3 style="color: #1f2937;">Your Settlement Account Needs Attention</h3>
                    <p>This is an automated notification to let you know that your cash balance is running low.</p>
                    <p>Your current balance is <strong>${formatCurrency(currentBalance)}</strong>, which is below the recommended threshold of $50.</p>
                    <p>To ensure you can make future investments without interruption, you may want to add more funds to your account.</p>
                    <br>
                    <div style="text-align: center;">
                        <a href="${appUrl}" style="background-color: #0d9488; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Add Funds Now</a>
                    </div>
                </div>
                <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0;">This alert was triggered automatically after a recent transaction.</p>
                </div>
            </div>
        `,
    };

    try {
        let info = await transporter.sendMail(message);
        console.log(`Low balance warning sent successfully to ${userEmail}`);
    } catch (error) {
        console.error('!!! FAILED TO SEND LOW BALANCE Alert !!!');
        if (error.response) console.error('Error Body:', error.response.body);
    }
}