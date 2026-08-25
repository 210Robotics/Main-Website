import "server-only";
import PDFDocument from "pdfkit";

export async function buildMembershipReceiptPdf(input: {
  receiptNumber: string;
  memberName: string;
  paymentDate: Date;
  amountCents: number;
  paymentMethod: string;
  coveragePeriod: string;
  transactionReference?: string | null;
  status: string;
}) {
  const doc = new PDFDocument({ size: "LETTER", margin: 54, info: { Title: `210 Robotics receipt ${input.receiptNumber}` } });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.rect(0, 0, 612, 94).fill("#101010");
  doc.fillColor("#FD7803").font("Helvetica-Bold").fontSize(25).text("210 ROBOTICS", 54, 32);
  doc.fillColor("#FFFFFF").font("Helvetica").fontSize(10).text("MEMBERSHIP DUES RECEIPT", 390, 40, { align: "right", width: 168 });
  doc.fillColor("#171717").font("Helvetica-Bold").fontSize(20).text("Payment received", 54, 132);
  doc.font("Helvetica").fontSize(10).fillColor("#666666").text("This receipt confirms team membership dues. It is not a charitable donation receipt.", 54, 164, { width: 504 });
  const rows = [
    ["Receipt number", input.receiptNumber],
    ["Member", input.memberName],
    ["Payment date", input.paymentDate.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" })],
    ["Amount", (input.amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })],
    ["Payment method", input.paymentMethod.replaceAll("_", " ")],
    ["Membership period", input.coveragePeriod],
    ["Transaction reference", input.transactionReference || "Not provided"],
    ["Status", input.status],
  ];
  let y = 215;
  for (const [label, value] of rows) {
    doc.rect(54, y, 504, 42).fill(y % 84 === 47 ? "#F4F4F4" : "#FAFAFA");
    doc.fillColor("#666666").font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), 68, y + 14, { width: 170 });
    doc.fillColor("#171717").font("Helvetica").fontSize(10).text(value, 240, y + 13, { width: 300, align: "right" });
    y += 44;
  }
  doc.moveTo(54, 650).lineTo(558, 650).strokeColor("#FD7803").lineWidth(2).stroke();
  doc.fillColor("#666666").fontSize(9).text("210 Robotics · San Antonio, Texas · 210robotics.com", 54, 666, { width: 504, align: "center" });
  doc.end();
  return complete;
}
