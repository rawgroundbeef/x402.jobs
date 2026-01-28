import BaseLayout from "@/components/BaseLayout";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="py-8 md:py-12">{children}</div>
    </BaseLayout>
  );
}
