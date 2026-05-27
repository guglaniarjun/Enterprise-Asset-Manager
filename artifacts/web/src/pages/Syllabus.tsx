import { useListSyllabus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Syllabus() {
  const { data, isLoading } = useListSyllabus({}, {
    query: {
      queryKey: ["syllabusList"]
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Syllabus Plan</h1>
        <Button>Add Plan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.teacherName}</TableCell>
                    <TableCell>{plan.className} {plan.sectionName}</TableCell>
                    <TableCell>{plan.subjectName}</TableCell>
                    <TableCell>{plan.chapter} - {plan.topic}</TableCell>
                    <TableCell>
                      <Badge variant={
                        plan.status === 'Completed' ? 'default' : 
                        plan.status === 'Delayed' ? 'destructive' : 'secondary'
                      }>
                        {plan.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No syllabus plans found
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
