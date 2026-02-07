// Generate a cover letter as a Word (.docx) file.
// Keeps CV as PDF while cover letters can be edited in Word.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function safeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function getPersonalInfo(snapshot) {
  const p = snapshot?.personalInfo && typeof snapshot.personalInfo === 'object' ? snapshot.personalInfo : {};
  return {
    fullName: safeText(p.fullName) || 'Your Name',
    email: safeText(p.email),
    phone: safeText(p.phone),
    address: safeText(p.address),
    city: safeText(p.city),
    country: safeText(p.country),
    linkedinUrl: safeText(p.linkedinUrl),
    githubUrl: safeText(p.githubUrl)
  };
}

function getCover(snapshot) {
  // Support both shapes (older/newer).
  const role = safeText(snapshot?.coverLetterRole || snapshot?.coverLetter?.role);
  const company = safeText(snapshot?.coverLetterCompany || snapshot?.coverLetter?.company);
  const companyAddress = safeText(snapshot?.coverCompanyAddress || snapshot?.coverLetter?.companyAddress);
  const text = safeText(snapshot?.coverLetterText || snapshot?.coverLetter?.text);
  return { role, company, companyAddress, text };
}

function formatLongDate(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-ZM', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function normalizeCompanyAddressLines(companyAddrRaw) {
  const raw = String(companyAddrRaw || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  if (raw.includes('\n')) {
    return raw
      .split(/\n+/g)
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  }

  if (raw.includes(',')) {
    const parts = raw
      .split(',')
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    // Common input: "Plot 2000, Lumumba Road, Lusaka, Zambia" =>
    // lines: Plot 2000 / Lumumba Road / Lusaka, Zambia
    if (parts.length >= 4) {
      const first = parts[0];
      const middle = parts.slice(1, -2).join(', ').trim();
      const last = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
      return [first, middle, last].filter(Boolean);
    }

    if (parts.length === 3) return parts;
    if (parts.length === 2) return parts;
    return parts.length ? parts : [raw];
  }

  return [raw];
}

exports.handler = async (event) => {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const snapshot = body?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing snapshot' })
    };
  }

  const { Document, Packer, Paragraph, TextRun } = require('docx');

  const p = getPersonalInfo(snapshot);
  const c = getCover(snapshot);

  if (!c.text) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Cover letter text is empty' })
    };
  }

  const addressLine = p.address || 'Address';
  const townLine = p.city || 'Town';
  const countryLine = p.country || 'Country';
  const emailLine = p.email ? `Email: ${p.email} |` : '';
  const phoneLine = p.phone ? `Phone: ${p.phone} |` : '';

  const paragraphs = [];

  // Applicant block
  // Use 12pt for name in Word cover letter.
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: p.fullName, bold: true, size: 24 })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: addressLine, size: 24 })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: townLine, size: 24 })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: countryLine, size: 24 })] }));
  if (emailLine) paragraphs.push(new Paragraph({ children: [new TextRun({ text: emailLine, size: 24 })] }));
  if (phoneLine) paragraphs.push(new Paragraph({ children: [new TextRun({ text: phoneLine, size: 24 })] }));

  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: formatLongDate(new Date()), size: 24 })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));

  // Company block (placeholders if missing)
  const companyName = c.company || 'Company Name';
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: companyName, size: 24, bold: true })] }));

  const companyAddrRaw = String(c.companyAddress || '').replace(/\r\n/g, '\n').trim();
  if (companyAddrRaw) {
    const companyAddrLines = normalizeCompanyAddressLines(companyAddrRaw);

    for (const line of companyAddrLines) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }));
    }
  } else {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'Company Address', size: 24 })] }));
  }

  // After company Town/Country, leave a blank line, then the salutation.
  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: 'Dear Hiring Manager,', size: 24 })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));

  // Subject line in block letters, then body.
  const roleText = c.role || 'Role';
  const reLine = `RE: APPLICATION FOR ${roleText}`.toUpperCase();
  paragraphs.push(new Paragraph({ children: [new TextRun({ text: reLine, size: 24, bold: true })] }));
  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));

  // Body paragraphs (preserve blank lines). Avoid duplicating salutation/subject if present.
  let bodyText = String(c.text).replace(/\r\n/g, '\n').trim();
  bodyText = bodyText.replace(/^\s*dear\s+[^\n]+\n+/i, '');
  bodyText = bodyText.replace(/^\s*re\s*:\s*[^\n]+\n+/i, '');
  bodyText = bodyText.trim();

  const parts = bodyText.split(/\n\n+/g).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const lines = String(part || '')
      .split(/\n+/g)
      .map((line) => String(line || '').trim())
      .filter(Boolean);

    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })]
        })
      );
    }
    paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);

  const base64 = Buffer.from(buffer).toString('base64');
  const fileName = String(body?.fileName || '').trim() || 'Cover_Letter.docx';

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      ...headers,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`
    },
    body: base64
  };
};
