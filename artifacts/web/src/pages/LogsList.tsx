import { useListLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function LogsList() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListLogs(
    { page, limit: 20 },
    {
      query: {
        queryKey: ["logsList", page],
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Class Logs</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Logs</CardTitle>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>{log.date}</TableCell>
                      <TableCell className="font-medium">
                        {log.teacherName}
                      </TableCell>
                      <TableCell>
                        {log.className} {log.sectionName}
                      </TableCell>
                      <TableCell>{log.subjectName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.verificationStatus === "Verified"
                              ? "default"
                              : log.verificationStatus === "Rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {log.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.data || data.data.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No logs found
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
