import { useListTasks, useUpdateTask } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTasksQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function TasksList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading } = useListTasks({}, {
    query: {
      queryKey: ["tasksList"]
    }
  });

  const updateTask = useUpdateTask();

  const handleComplete = (id: number) => {
    updateTask.mutate({ id, data: { status: "Completed" } }, {
      onSuccess: () => {
        toast({ title: "Task completed" });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Button>New Task</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((task) => (
                  <TableRow key={task.id} className={task.status === 'Completed' ? 'opacity-50' : ''}>
                    <TableCell>
                      {task.status === 'Completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-orange-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.priority === 'High' ? 'destructive' : task.priority === 'Medium' ? 'default' : 'secondary'}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.dueDate || '-'}</TableCell>
                    <TableCell>{task.assignedToName || 'Unassigned'}</TableCell>
                    <TableCell className="text-right">
                      {task.status !== 'Completed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleComplete(task.id)} disabled={updateTask.isPending}>
                          Mark Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No tasks found
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
