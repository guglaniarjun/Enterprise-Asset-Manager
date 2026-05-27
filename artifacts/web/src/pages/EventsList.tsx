import { useListEvents, useResolveEvent } from "@workspace/api-client-react";
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
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getListEventsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function EventsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListEvents(
    {},
    {
      query: {
        queryKey: ["eventsList"],
      },
    },
  );

  const resolveEvent = useResolveEvent();

  const handleResolve = (id: number) => {
    resolveEvent.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Event resolved" });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Student Events</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events Log</CardTitle>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      {event.logDate
                        ? new Date(event.logDate).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {event.studentName}
                    </TableCell>
                    <TableCell>{event.eventType}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.severity === "High"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === "Resolved" ? "default" : "secondary"
                        }
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {event.status !== "Resolved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResolve(event.id)}
                          disabled={resolveEvent.isPending}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No events found
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
