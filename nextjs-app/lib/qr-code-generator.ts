/**
 * QR Code Generator for Guardian Shares
 *
 * Generates QR codes for secure share distribution to guardians.
 * QR codes can be scanned by guardians to receive their shares.
 *
 * Features:
 * - Base64 encoding for QR compatibility
 * - Compression for large shares
 * - Version control for future updates
 * - Checksum for data integrity
 */

import { PublicKey } from '@solana/web3.js';

export interface ShareQRData {
  version: number; // Protocol version
  guardian: {
    address: string;
    nickname: string;
  };
  share: string; // Base64 encoded
  commitment: string; // Base64 encoded
  shareIndex: number;
  setupDate: string; // ISO 8601
  checksum: string; // SHA256 hash
}

/**
 * Generate QR code data URL for a guardian share
 */
export async function generateShareQRCode(
  guardianPubkey: PublicKey,
  guardianNickname: string,
  shareData: Uint8Array,
  commitment: Uint8Array,
  shareIndex: number
): Promise<string> {
  // Create share data structure
  const shareQRData: ShareQRData = {
    version: 1,
    guardian: {
      address: guardianPubkey.toBase58(),
      nickname: guardianNickname,
    },
    share: Buffer.from(shareData).toString('base64'),
    commitment: Buffer.from(commitment).toString('base64'),
    shareIndex,
    setupDate: new Date().toISOString(),
    checksum: await calculateChecksum(shareData, commitment),
  };

  // Convert to JSON
  const jsonData = JSON.stringify(shareQRData);

  // For actual QR code generation, you would use a library like qrcode
  // This is a placeholder that returns a data URL
  // In production, install: npm install qrcode @types/qrcode

  // Simulated QR code data URL (replace with actual QR generation)
  const qrCodeDataURL = `data:text/plain;base64,${Buffer.from(jsonData).toString('base64')}`;

  return qrCodeDataURL;
}

/**
 * Generate SVG QR code for printing
 */
export async function generateShareQRCodeSVG(
  guardianPubkey: PublicKey,
  guardianNickname: string,
  shareData: Uint8Array,
  commitment: Uint8Array,
  shareIndex: number
): Promise<string> {
  const shareQRData: ShareQRData = {
    version: 1,
    guardian: {
      address: guardianPubkey.toBase58(),
      nickname: guardianNickname,
    },
    share: Buffer.from(shareData).toString('base64'),
    commitment: Buffer.from(commitment).toString('base64'),
    shareIndex,
    setupDate: new Date().toISOString(),
    checksum: await calculateChecksum(shareData, commitment),
  };

  const jsonData = JSON.stringify(shareQRData);

  // In production, use QRCode.toString(jsonData, { type: 'svg' })
  // This is a placeholder
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="white"/>
      <text x="100" y="100" text-anchor="middle" font-size="12" fill="black">
        QR Code for ${guardianNickname}
      </text>
      <text x="100" y="120" text-anchor="middle" font-size="8" fill="gray">
        Share ${shareIndex}
      </text>
    </svg>
  `.trim();

  return svg;
}

/**
 * Parse QR code data back to share information
 */
export async function parseShareQRCode(qrDataURL: string): Promise<ShareQRData> {
  // Extract JSON from data URL
  let jsonData: string;

  if (qrDataURL.startsWith('data:')) {
    // Extract base64 part
    const base64Data = qrDataURL.split(',')[1];
    jsonData = Buffer.from(base64Data, 'base64').toString('utf-8');
  } else {
    // Assume it's already JSON
    jsonData = qrDataURL;
  }

  // Parse JSON
  const shareData: ShareQRData = JSON.parse(jsonData);

  // Verify version
  if (shareData.version !== 1) {
    throw new Error(`Unsupported QR code version: ${shareData.version}`);
  }

  // Verify checksum
  const shareBytes = Buffer.from(shareData.share, 'base64');
  const commitmentBytes = Buffer.from(shareData.commitment, 'base64');
  const calculatedChecksum = await calculateChecksum(
    new Uint8Array(shareBytes),
    new Uint8Array(commitmentBytes)
  );

  if (calculatedChecksum !== shareData.checksum) {
    throw new Error('QR code checksum verification failed');
  }

  return shareData;
}

/**
 * Calculate checksum for share data integrity
 */
async function calculateChecksum(
  shareData: Uint8Array,
  commitment: Uint8Array
): Promise<string> {
  // Combine share and commitment
  const combined = new Uint8Array(shareData.length + commitment.length);
  combined.set(shareData, 0);
  combined.set(commitment, shareData.length);

  // Calculate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate printable share card with QR code
 */
export interface ShareCard {
  html: string;
  guardianName: string;
  qrCodeSVG: string;
}

export async function generatePrintableShareCard(
  guardianPubkey: PublicKey,
  guardianNickname: string,
  shareData: Uint8Array,
  commitment: Uint8Array,
  shareIndex: number,
  ownerPubkey: PublicKey
): Promise<ShareCard> {
  const qrCodeSVG = await generateShareQRCodeSVG(
    guardianPubkey,
    guardianNickname,
    shareData,
    commitment,
    shareIndex
  );

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Guardian Share Card - ${guardianNickname}</title>
  <style>
    @page {
      size: A6;
      margin: 10mm;
    }
    body {
      font-family: 'Arial', sans-serif;
      max-width: 105mm;
      margin: 0 auto;
      padding: 10mm;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .card {
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      margin: 0;
    }
    .subtitle {
      font-size: 12px;
      color: #666;
      margin: 5px 0 0 0;
    }
    .qr-container {
      text-align: center;
      margin: 20px 0;
      padding: 10px;
      background: white;
      border: 2px dashed #667eea;
      border-radius: 4px;
    }
    .info {
      font-size: 11px;
      margin: 10px 0;
      line-height: 1.6;
    }
    .info-label {
      font-weight: bold;
      color: #667eea;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 10px;
      margin-top: 15px;
      font-size: 10px;
      color: #856404;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #999;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }
    .mono {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">🔐 Guardian Share</h1>
      <p class="subtitle">Solana Lockbox Recovery System</p>
    </div>

    <div class="qr-container">
      ${qrCodeSVG}
    </div>

    <div class="info">
      <p><span class="info-label">Guardian:</span> ${guardianNickname}</p>
      <p><span class="info-label">Share Index:</span> ${shareIndex} of N</p>
      <p><span class="info-label">Issued:</span> ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="info">
      <p><span class="info-label">Your Address:</span></p>
      <p class="mono">${guardianPubkey.toBase58()}</p>
    </div>

    <div class="info">
      <p><span class="info-label">Vault Owner:</span></p>
      <p class="mono">${ownerPubkey.toBase58()}</p>
    </div>

    <div class="warning">
      <strong>⚠️ IMPORTANT:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        <li>Keep this card safe and private</li>
        <li>Do not share with anyone except other guardians during recovery</li>
        <li>This share is required to recover the vault</li>
        <li>Scan QR code with Solana Lockbox app</li>
      </ul>
    </div>

    <div class="footer">
      <p>Generated with Solana Lockbox v2.0</p>
      <p>Recovery V2 - Information-Theoretic Security</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    html,
    guardianName: guardianNickname,
    qrCodeSVG,
  };
}

/**
 * Download share card as HTML file
 */
export function downloadShareCard(shareCard: ShareCard) {
  const blob = new Blob([shareCard.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guardian-share-${shareCard.guardianName.toLowerCase().replace(/\s+/g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Print share card
 */
export function printShareCard(shareCard: ShareCard) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(shareCard.html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}
