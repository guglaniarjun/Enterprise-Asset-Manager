import { useGetSyllabusSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function SyllabusSummary() {
  const { data, isLoading } = useGetSyllabusSummary({}, {
    query: {
      queryKey: ["syllabusSummary"]
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Syllabus Completion Overview</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Overall Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{data?.completionPercent?.toFixed(1) || 0}%</span>
            <span className="text-sm text-muted-foreground">
              {data?.totalEntries || 0} Total Entries
            </span>
          </div>
          <Progress value={data?.completionPercent || 0} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                {Object.entries(data?.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{status}</span>
                    <span className="text-sm text-muted-foreground">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
