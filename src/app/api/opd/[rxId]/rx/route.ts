import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    props: { params: Promise<{ rxId: string }> }
) {
    const params = await props.params;
    const { rxId } = params;

    // Simple HTML response for now - will be enhanced with actual data
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prescription - ${rxId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .content {
            padding: 20px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
        }
        .print-btn {
            background: #10b981;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 20px 0;
        }
        @media print {
            .print-btn { display: none; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    <div class="header">
        <h1>Spotnet Medical Center</h1>
        <p>Prescription ID: ${rxId}</p>
    </div>
    <div class="content">
        <h2>Patient Information</h2>
        <p>This is a placeholder. Full colorful Rx PDF will be implemented.</p>
    </div>
</body>
</html>
  `;

    return new NextResponse(htmlContent, {
        headers: {
            'Content-Type': 'text/html',
        },
    });
}
