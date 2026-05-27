import { useGetComplianceAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export default function Compliance() {
  const [dateFrom, setDateFrom] = useState(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const { data, isLoading } = useGetComplianceAnalytics({ dateFrom, dateTo }, {
    query: {
      queryKey: ["complianceAnalytics", dateFrom, dateTo]
    }
  });

  const overallPercent = (data?.summary as any)?.overallPercent || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Compliance Analytics</h1>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
          <span>to</span>
          <Input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Overall Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold">{overallPercent.toFixed(1)}%</span>
            <span className="text-sm text-muted-foreground">
              {(data?.summary as any)?.totalSubmitted || 0} / {(data?.summary as any)?.totalExpected || 0} expected logs
            </span>
          </div>
          <Progress value={overallPercent} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byTeacher?.map((t: any) => (
                    <TableRow key={t.teacherId}>
                      <TableCell className="font-medium">{t.teacherName}</TableCell>
                      <TableCell>{t.submitted} / {t.expected}</TableCell>
                      <TableCell className="text-right">
                        <span className={t.compliancePercent < 80 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          {t.compliancePercent.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.byTeacher || data.byTeacher.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">No data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Class</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.byClass?.map((c: any) => (
                    <TableRow key={c.classId}>
                      <TableCell className="font-medium">{c.className}</TableCell>
                      <TableCell>{c.submitted} / {c.expected}</TableCell>
                      <TableCell className="text-right">
                        <span className={c.compliancePercent < 80 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                          {c.compliancePercent.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.byClass || data.byClass.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-4">No data</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
