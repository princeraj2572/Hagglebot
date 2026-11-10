import { SellerChat } from "@/components/SellerChat";

export default async function SellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SellerChat threadId={decodeURIComponent(id)} />;
}
