import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateLog, useGetTeacherDashboard } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const logSchema = z.object({
  date: z.string().min(1, "Date is required"),
  assignmentId: z.string().min(1, "Class/Subject is required"),
  periodNumber: z.coerce.number().min(1, "Period number is required"),
  topicPlanned: z.string().optional(),
  topicTaught: z.string().optional(),
  syllabusStatus: z.string().optional(),
  teachingMethod: z.string().optional(),
  homeworkGiven: z.boolean().default(false),
  homeworkDetails: z.string().optional(),
  notebookWorkGiven: z.boolean().default(false),
  notebookWorkDetails: z.string().optional(),
  disciplineIssue: z.boolean().default(false),
  disciplineDetails: z.string().optional(),
  achievementDetails: z.string().optional(),
  improvementDetails: z.string().optional(),
  remarks: z.string().optional(),
});

export default function SubmitLog() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: dashboard } = useGetTeacherDashboard({ date: today });
  
  const form = useForm<z.infer<typeof logSchema>>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      date: today,
      assignmentId: "",
      periodNumber: 1,
      homeworkGiven: false,
      notebookWorkGiven: false,
      disciplineIssue: false,
    },
  });

  const createLog = useCreateLog();

  function onSubmit(values: z.infer<typeof logSchema>) {
    const assignment = dashboard?.assignments?.find(a => a.id.toString() === values.assignmentId);
    if (!assignment) return;

    createLog.mutate({
      data: {
        branchId: assignment.branchId,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        date: values.date,
        periodNumber: values.periodNumber,
        topicPlanned: values.topicPlanned,
        topicTaught: values.topicTaught,
        syllabusStatus: values.syllabusStatus,
        teachingMethod: values.teachingMethod,
        homeworkGiven: values.homeworkGiven,
        homeworkDetails: values.homeworkDetails,
        notebookWorkGiven: values.notebookWorkGiven,
        notebookWorkDetails: values.notebookWorkDetails,
        disciplineIssue: values.disciplineIssue,
        disciplineDetails: values.disciplineDetails,
        achievementDetails: values.achievementDetails,
        improvementDetails: values.improvementDetails,
        remarks: values.remarks,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Log submitted successfully" });
        setLocation("/dashboard/teacher");
      },
      onError: (err: any) => {
        toast({ title: "Failed to submit log", description: err.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Submit Daily Log</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class & Subject</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class/subject" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dashboard?.assignments?.map(a => (
                            <SelectItem key={a.id} value={a.id.toString()}>
                              {a.className} {a.sectionName} - {a.subjectName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Number</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={10} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="syllabusStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Syllabus Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="On Track">On Track</SelectItem>
                          <SelectItem value="Ahead">Ahead</SelectItem>
                          <SelectItem value="Behind">Behind</SelectItem>
                          <SelectItem value="Delayed">Delayed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="topicPlanned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic Planned</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="topicTaught"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic Taught</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="teachingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teaching Method</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Lecture, Activity, Group Discussion" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border p-4 rounded-md">
                <FormField
                  control={form.control}
                  name="homeworkGiven"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Homework Given</FormLabel>
                    </FormItem>
                  )}
                />
                {form.watch("homeworkGiven") && (
                  <FormField
                    control={form.control}
                    name="homeworkDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder="Homework details..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <FormField
                  control={form.control}
                  name="notebookWorkGiven"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Notebook Work Given</FormLabel>
                    </FormItem>
                  )}
                />
                {form.watch("notebookWorkGiven") && (
                  <FormField
                    control={form.control}
                    name="notebookWorkDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder="Notebook work details..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4 border p-4 rounded-md border-destructive/20">
                <FormField
                  control={form.control}
                  name="disciplineIssue"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="text-destructive">Discipline Issue to Report</FormLabel>
                    </FormItem>
                  )}
                />
                {form.watch("disciplineIssue") && (
                  <FormField
                    control={form.control}
                    name="disciplineDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea placeholder="Discipline issue details..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLocation("/dashboard/teacher")}>Cancel</Button>
                <Button type="submit" disabled={createLog.isPending}>Submit Log</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
