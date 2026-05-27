import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSyllabus,
  useVerifySyllabus,
  useListClasses,
} from "@workspace/api-client-react";
import { useAuth } from "../contexts/AuthContext";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Pencil, Plus } from "lucide-react";

export default function Syllabus() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(classFilter !== "all" ? { classId: parseInt(classFilter, 10) } : {}),
  };
  const { data, isLoading } = useListSyllabus(params, {
    query: { queryKey: ["syllabusList", statusFilter, classFilter] },
  });
  const { data: classesData } = useListClasses();
  const verify = useVerifySyllabus();

  const roles = user?.roles.map((r) => r.roleName) ?? [];
  const isTeacher = roles.includes("Teacher");
  const canApprove = roles.some((r) =>
    ["Coordinator", "Principal", "Director", "Super Admin"].includes(r),
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["syllabusList"] });

  const act = (id: number, approved: boolean) => {
    verify.mutate(
      { id, data: { approved } },
      {
        onSuccess: () => {
          toast({
            title: approved ? "Syllabus approved" : "Syllabus rejected",
          });
          invalidate();
        },
        onError: (err: unknown) =>
          toast({
            title: "Action failed",
            description: (err as Error).message,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Syllabus Plan</h1>
        {isTeacher && (
          <Button onClick={() => setLocation("/syllabus/new")}>
            <Plus className="w-4 h-4 mr-2" /> New plan
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Plans</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Planned">Planned</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classesData?.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter / Topic</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data?.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        {plan.teacherName}
                      </TableCell>
                      <TableCell>
                        {plan.className} {plan.sectionName ?? ""}
                      </TableCell>
                      <TableCell>{plan.subjectName}</TableCell>
                      <TableCell>
                        <div className="font-medium">{plan.chapter}</div>
                        <div className="text-xs text-muted-foreground">
                          {plan.topic}
                        </div>
                      </TableCell>
                      <TableCell>
                        {plan.month}
                        {plan.week ? `/W${plan.week}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.status === "Completed"
                              ? "default"
                              : plan.status === "Delayed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {isTeacher && plan.teacherId === user?.id && (
                          <Link href={`/syllabus/${plan.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        {canApprove && plan.status !== "Completed" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={verify.isPending}
                              onClick={() => act(plan.id, true)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />{" "}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={verify.isPending}
                              onClick={() => act(plan.id, false)}
                            >
                              <XCircle className="w-4 h-4 mr-1 text-destructive" />{" "}
                              Reject
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.data || data.data.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        No syllabus plans found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
