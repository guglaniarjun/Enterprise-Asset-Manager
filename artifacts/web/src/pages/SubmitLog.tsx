import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateLog,
  useUpdateLog,
  useGetLog,
  useGetTeacherDashboard,
  useListSyllabus,
  useListStudents,
  useCreateEvent,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, X, AlertTriangle } from "lucide-react";

const logSchema = z.object({
  date: z.string().min(1, "Date is required"),
  assignmentId: z.string().min(1, "Class/Subject is required"),
  periodNumber: z.coerce.number().min(1, "Period number is required"),
  syllabusId: z.string().optional(),
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
type LogValues = z.infer<typeof logSchema>;

type DraftEvent = {
  existingId?: number;
  studentId: number;
  studentName: string;
  eventType: string;
  severity: string;
  remarks?: string;
};

const EVENT_TYPES = ["Absent", "Late", "Inattentive", "Misbehaviour", "Achievement", "Counselling Needed", "Improvement Needed"];
const SEVERITIES = ["Low", "Medium", "High"];

export default function SubmitLog() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const editId = params.id ? parseInt(params.id, 10) : null;

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: dashboard } = useGetTeacherDashboard({ date: today });
  const { data: existing } = useGetLog(editId ?? 0, {
    query: { enabled: !!editId, queryKey: ["getLog", editId] },
  });

  const form = useForm<LogValues>({
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

  // hydrate edit mode
  useEffect(() => {
    if (existing && dashboard?.assignments) {
      const matched = dashboard.assignments.find(
        (a) => a.classId === existing.classId && a.sectionId === existing.sectionId && a.subjectId === existing.subjectId,
      );
      form.reset({
        date: existing.date,
        assignmentId: matched ? matched.id.toString() : "",
        periodNumber: existing.periodNumber,
        syllabusId: existing.syllabusId ? existing.syllabusId.toString() : undefined,
        topicPlanned: existing.topicPlanned ?? "",
        topicTaught: existing.topicTaught ?? "",
        syllabusStatus: existing.syllabusStatus ?? "",
        teachingMethod: existing.teachingMethod ?? "",
        homeworkGiven: existing.homeworkGiven,
        homeworkDetails: existing.homeworkDetails ?? "",
        notebookWorkGiven: existing.notebookWorkGiven,
        notebookWorkDetails: existing.notebookWorkDetails ?? "",
        disciplineIssue: existing.disciplineIssue,
        disciplineDetails: existing.disciplineDetails ?? "",
        achievementDetails: existing.achievementDetails ?? "",
        improvementDetails: existing.improvementDetails ?? "",
        remarks: existing.remarks ?? "",
      });
    }
  }, [existing, dashboard, form]);

  const assignmentId = form.watch("assignmentId");
  const assignment = useMemo(
    () => dashboard?.assignments?.find((a) => a.id.toString() === assignmentId),
    [dashboard, assignmentId],
  );

  // syllabus options for the selected class/section/subject (approved-only)
  const { data: syllabusListAll } = useListSyllabus(
    assignment ? { classId: assignment.classId, subjectId: assignment.subjectId } : undefined,
    {
      query: {
        enabled: !!assignment,
        queryKey: ["syllabusForLog", assignment?.classId, assignment?.subjectId],
      },
    },
  );
  const syllabusOptions = useMemo(
    () => syllabusListAll?.data?.filter(
      (s) => s.status === "In Progress" || s.status === "Completed",
    ) ?? [],
    [syllabusListAll],
  );

  // autofill topicPlanned when syllabus selected
  const syllabusId = form.watch("syllabusId");
  useEffect(() => {
    if (!syllabusId || syllabusOptions.length === 0) return;
    const s = syllabusOptions.find((x) => x.id.toString() === syllabusId);
    if (s) {
      const planned = [s.chapter, s.topic, s.subtopic].filter(Boolean).join(" — ");
      if (planned && !form.getValues("topicPlanned")) form.setValue("topicPlanned", planned);
    }
  }, [syllabusId, syllabusOptions, form]);

  // students for tagging
  const { data: studentsData } = useListStudents(
    assignment ? { classId: assignment.classId, sectionId: assignment.sectionId, limit: 200 } : undefined,
    {
      query: {
        enabled: !!assignment,
        queryKey: ["studentsForLog", assignment?.classId, assignment?.sectionId],
      },
    },
  );

  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [pickStudentId, setPickStudentId] = useState<string>("");
  const [pickType, setPickType] = useState<string>("Absent");
  const [pickSeverity, setPickSeverity] = useState<string>("Low");
  const [pickRemarks, setPickRemarks] = useState<string>("");

  // hydrate existing events when editing — preserve id so we don't duplicate on save
  useEffect(() => {
    if (existing && "studentEvents" in existing && existing.studentEvents) {
      setEvents(existing.studentEvents.map((e) => ({
        existingId: e.id,
        studentId: e.studentId,
        studentName: e.studentName,
        eventType: e.eventType,
        severity: e.severity,
        remarks: e.remarks ?? undefined,
      })));
    }
  }, [existing]);

  const addEvent = () => {
    if (!pickStudentId) { toast({ title: "Pick a student", variant: "destructive" }); return; }
    const stu = studentsData?.data?.find((s) => s.id.toString() === pickStudentId);
    if (!stu) return;
    setEvents((prev) => [...prev, {
      studentId: stu.id, studentName: stu.name,
      eventType: pickType, severity: pickSeverity, remarks: pickRemarks || undefined,
    }]);
    setPickStudentId(""); setPickRemarks("");
  };

  const removeEvent = (idx: number) => setEvents((prev) => prev.filter((_, i) => i !== idx));

  const createLog = useCreateLog();
  const updateLog = useUpdateLog();
  const createEvent = useCreateEvent();

  async function onSubmit(values: LogValues) {
    if (editId && existing) {
      // edit mode — only mutable fields
      updateLog.mutate({
        id: editId,
        data: {
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
        },
      }, {
        onSuccess: async () => {
          // post only events newly added in this edit session (no existingId)
          const newOnes = events.filter((e) => e.existingId === undefined);
          const failed: string[] = [];
          for (const ev of newOnes) {
            try {
              await createEvent.mutateAsync({ data: { dailyLogId: editId, studentId: ev.studentId, eventType: ev.eventType, severity: ev.severity, remarks: ev.remarks } });
            } catch (err) {
              failed.push(`${ev.studentName}: ${(err as Error).message}`);
            }
          }
          if (failed.length > 0) {
            toast({ title: "Log updated — some events failed", description: failed.join("; "), variant: "destructive" });
          } else {
            toast({ title: "Log updated" });
          }
          setLocation(`/logs/${editId}`);
        },
        onError: (err: unknown) => toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" }),
      });
      return;
    }

    if (!assignment) { toast({ title: "Pick an assignment", variant: "destructive" }); return; }

    createLog.mutate({
      data: {
        branchId: assignment.branchId,
        classId: assignment.classId,
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        date: values.date,
        periodNumber: values.periodNumber,
        syllabusId: values.syllabusId ? parseInt(values.syllabusId, 10) : undefined,
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
      },
    }, {
      onSuccess: async (created) => {
        const failed: string[] = [];
        for (const ev of events) {
          try {
            await createEvent.mutateAsync({ data: { dailyLogId: created.id, studentId: ev.studentId, eventType: ev.eventType, severity: ev.severity, remarks: ev.remarks } });
          } catch (err) {
            failed.push(`${ev.studentName}: ${(err as Error).message}`);
          }
        }
        if (failed.length > 0) {
          toast({ title: "Log saved — some events failed", description: failed.join("; "), variant: "destructive" });
        } else {
          toast({ title: "Log submitted", description: events.length ? `${events.length} student event(s) tagged.` : undefined });
        }
        setLocation("/dashboard/teacher");
      },
      onError: (err: unknown) => toast({ title: "Submit failed", description: (err as Error).message, variant: "destructive" }),
    });
  }

  const isPending = createLog.isPending || updateLog.isPending;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {editId ? "Edit daily log" : "Submit daily log"}
        </h1>
        {editId && existing?.verificationStatus === "Rejected" && existing.coordinatorRemarks && (
          <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-md">
            <AlertTriangle className="w-4 h-4" />
            Rejected: {existing.coordinatorRemarks}
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Log details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} disabled={!!editId} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignmentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class & Subject</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editId}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select class/subject" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {dashboard?.assignments?.map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {a.className} {a.sectionName} — {a.subjectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="periodNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period number</FormLabel>
                    <FormControl><Input type="number" min={1} max={10} {...field} disabled={!!editId} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="syllabusStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Syllabus status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="On Track">On Track</SelectItem>
                        <SelectItem value="Ahead">Ahead</SelectItem>
                        <SelectItem value="Behind">Behind</SelectItem>
                        <SelectItem value="Delayed">Delayed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="syllabusId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked syllabus topic (optional — autofills topic planned)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!assignment || syllabusOptions.length === 0}>
                    <FormControl><SelectTrigger><SelectValue placeholder={!assignment ? "Pick a class first" : syllabusOptions.length === 0 ? "No approved syllabus yet" : "Select planned topic"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {syllabusOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          M{s.month}{s.week ? `/W${s.week}` : ""} — {s.chapter}: {s.topic}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="topicPlanned" render={({ field }) => (
                  <FormItem><FormLabel>Topic planned</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="topicTaught" render={({ field }) => (
                  <FormItem><FormLabel>Topic taught</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="teachingMethod" render={({ field }) => (
                <FormItem><FormLabel>Teaching method</FormLabel><FormControl><Input {...field} placeholder="Lecture, Activity, Discussion, …" /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="space-y-4 border p-4 rounded-md">
                <FormField control={form.control} name="homeworkGiven" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Homework given</FormLabel>
                  </FormItem>
                )} />
                {form.watch("homeworkGiven") && (
                  <FormField control={form.control} name="homeworkDetails" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Homework details…" {...field} /></FormControl></FormItem>
                  )} />
                )}
              </div>

              <div className="space-y-4 border p-4 rounded-md">
                <FormField control={form.control} name="notebookWorkGiven" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Notebook work given</FormLabel>
                  </FormItem>
                )} />
                {form.watch("notebookWorkGiven") && (
                  <FormField control={form.control} name="notebookWorkDetails" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Notebook work details…" {...field} /></FormControl></FormItem>
                  )} />
                )}
              </div>

              <div className="space-y-4 border p-4 rounded-md border-destructive/20">
                <FormField control={form.control} name="disciplineIssue" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="text-destructive">Discipline issue to report</FormLabel>
                  </FormItem>
                )} />
                {form.watch("disciplineIssue") && (
                  <FormField control={form.control} name="disciplineDetails" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Discipline issue details…" {...field} /></FormControl></FormItem>
                  )} />
                )}
              </div>

              <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Student events</h3>
                    <p className="text-xs text-muted-foreground">Tag absences, achievements, counselling needs, etc.</p>
                  </div>
                  {events.length > 0 && <Badge variant="secondary">{events.length} tagged</Badge>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Select value={pickStudentId} onValueChange={setPickStudentId}>
                    <SelectTrigger className="md:col-span-2"><SelectValue placeholder={assignment ? "Select student" : "Pick class first"} /></SelectTrigger>
                    <SelectContent>
                      {studentsData?.data?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.admissionNo} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pickType} onValueChange={setPickType}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pickSeverity} onValueChange={setPickSeverity}>
                    <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addEvent} disabled={!assignment || !pickStudentId}>
                    <Plus className="w-4 h-4 mr-1" /> Tag
                  </Button>
                </div>
                <Input
                  placeholder="Optional remarks for this event…"
                  value={pickRemarks}
                  onChange={(e) => setPickRemarks(e.target.value)}
                  disabled={!assignment}
                />

                {events.length > 0 && (
                  <div className="space-y-1">
                    {events.map((ev, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm border rounded px-3 py-2 bg-background">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{ev.studentName}</span>
                          <Badge variant="outline">{ev.eventType}</Badge>
                          <Badge variant={ev.severity === "High" ? "destructive" : "secondary"}>{ev.severity}</Badge>
                          {ev.remarks && <span className="text-muted-foreground italic">"{ev.remarks}"</span>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEvent(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="achievementDetails" render={({ field }) => (
                  <FormItem><FormLabel>Achievements</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="improvementDetails" render={({ field }) => (
                  <FormItem><FormLabel>Needs improvement</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel>Additional remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLocation(editId ? `/logs/${editId}` : "/dashboard/teacher")}>Cancel</Button>
                <Button type="submit" disabled={isPending}>{editId ? "Save changes" : "Submit log"}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
