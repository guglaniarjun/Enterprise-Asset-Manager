import { useListAlerts, useAcknowledgeAlert, useResolveAlert } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAlertsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function AlertsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading } = useListAlerts({ status: "New,Acknowledged" }, {
    query: {
      queryKey: ["alertsList", "New,Acknowledged"]
    }
  });

  const ackAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();

  const handleAck = (id: number) => {
    ackAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert acknowledged" });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey({ status: "New,Acknowledged" }) });
      }
    });
  };

  const handleResolve = (id: number) => {
    resolveAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert resolved" });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey({ status: "New,Acknowledged" }) });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">System Alerts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
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
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      {alert.severity === 'Critical' ? (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      ) : alert.severity === 'High' ? (
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Info className="w-5 h-5 text-blue-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{alert.alertType}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={alert.message}>{alert.message}</TableCell>
                    <TableCell>
                      <Badge variant={alert.status === 'New' ? 'destructive' : 'secondary'}>
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(alert.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {alert.status === 'New' && (
                        <Button variant="outline" size="sm" onClick={() => handleAck(alert.id)} disabled={ackAlert.isPending}>
                          Acknowledge
                        </Button>
                      )}
                      <Button variant="default" size="sm" onClick={() => handleResolve(alert.id)} disabled={resolveAlert.isPending}>
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No active alerts
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
