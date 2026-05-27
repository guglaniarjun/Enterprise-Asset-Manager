import { useGetMissingLogs } from "@workspace/api-client-react";
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
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

export default function MissingLogs() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading } = useGetMissingLogs(
    { date },
    {
      query: {
        queryKey: ["missingLogs", date],
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Missing Logs Report
        </h1>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <label className="text-sm font-medium">Date:</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-destructive">
              Total Missing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {data?.totalMissing || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teachers with Missing Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.missing?.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {item.teacherName}
                    </TableCell>
                    <TableCell>{item.className}</TableCell>
                    <TableCell>{item.sectionName}</TableCell>
                    <TableCell>{item.subjectName}</TableCell>
                  </TableRow>
                ))}
                {(!data?.missing || data.missing.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No missing logs found for this date
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
