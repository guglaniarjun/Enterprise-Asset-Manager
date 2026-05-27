import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function AuditLogs() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAuditLogs(
    { page, limit: 50 },
    {
      query: {
        queryKey: ["auditLogsList", page],
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.userName || "System"}
                      </TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        {log.entityType}{" "}
                        {log.entityId ? `#${log.entityId}` : ""}
                      </TableCell>
                      <TableCell>{log.ipAddress || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {(!data?.data || data.data.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-8"
                      >
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(data.pagination.totalPages, p + 1),
                      )
                    }
                    disabled={page === data.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
