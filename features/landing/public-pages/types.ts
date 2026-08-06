export type PublicPageSection = {
  title: string;
  body: string;
  details?: string;
  items?: string[];
};

export type PublicPageContent = {
  eyebrow: "Product" | "Company";
  title: string;
  headline?: string;
  description: string;
  sections: PublicPageSection[];
};
