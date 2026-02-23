import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { InstrumentDetail } from "@/components/holdings/instrument-detail";

export default async function InstrumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ uic: string; assetType: string }>;
  searchParams: Promise<{ symbol?: string; name?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { uic, assetType } = await params;
  const { symbol, name } = await searchParams;

  const uicNum = parseInt(uic, 10);
  if (isNaN(uicNum)) notFound();

  return (
    <InstrumentDetail
      uic={uicNum}
      assetType={assetType}
      symbol={symbol ?? uic}
      name={name ?? ""}
    />
  );
}
