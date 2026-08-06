import { bookingManagementPage } from "@/features/landing/public-pages/content/booking-management";
import { calendarPage } from "@/features/landing/public-pages/content/calendar";
import { paymentsPage } from "@/features/landing/public-pages/content/payments";
import type { PublicPageContent } from "@/features/landing/public-pages/types";

export const productPages: Record<string, PublicPageContent> = {
  "booking-management": bookingManagementPage,
  calendar: calendarPage,
  payments: paymentsPage
};
