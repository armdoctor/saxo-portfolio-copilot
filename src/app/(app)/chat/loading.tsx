import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="flex-1 space-y-4 py-12">
        <div className="text-center">
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="mx-auto mt-4 h-4 w-64" />
        </div>
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 pt-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
