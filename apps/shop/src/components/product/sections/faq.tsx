import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { JsonLd } from "@/components/storefront/json-ld";
import { parseFaq, type ProductPageData } from "@/lib/catalog";

export function ProductFaq({ product }: { product: ProductPageData }) {
  const faq = parseFaq(product.faq);
  if (faq.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <section className="py-14 sm:py-20" aria-labelledby="faq-title">
      <JsonLd data={data} />
      <div className="container-shell max-w-3xl">
        <h2 id="faq-title" className="font-heading text-3xl font-bold sm:text-4xl">Questions fréquentes</h2>
        <Accordion type="single" collapsible className="mt-6 card-soft px-6">
          {faq.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`}>
              <AccordionTrigger>{f.question}</AccordionTrigger>
              <AccordionContent className="whitespace-pre-line">{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
