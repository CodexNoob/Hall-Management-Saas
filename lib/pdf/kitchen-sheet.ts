import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type KitchenSheetInput = {
  eventName: string;
  hallName: string;
  eventDate: string;
  guestCount: number;
  menuItems: string[];
};

export async function generateKitchenSheetPdf(input: KitchenSheetInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("Kitchen Sheet", { x: 54, y: 720, size: 24, font: bold, color: rgb(0.07, 0.31, 0.29) });
  page.drawText(input.eventName, { x: 54, y: 684, size: 16, font: bold });
  page.drawText(`Hall: ${input.hallName}`, { x: 54, y: 654, size: 12, font });
  page.drawText(`Date: ${input.eventDate}`, { x: 54, y: 632, size: 12, font });
  page.drawText(`Guests: ${input.guestCount}`, { x: 54, y: 610, size: 12, font });
  page.drawLine({ start: { x: 54, y: 586 }, end: { x: 558, y: 586 }, thickness: 1, color: rgb(0.78, 0.82, 0.8) });

  input.menuItems.forEach((item, index) => {
    page.drawText(`${index + 1}. ${item}`, { x: 72, y: 554 - index * 22, size: 11, font });
  });

  return pdf.save();
}
