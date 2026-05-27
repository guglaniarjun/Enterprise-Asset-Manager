import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateSyllabus,
  useUpdateSyllabus,
  useGetSyllabus,
  useListBranches,
  useListClasses,
  useListSections,
  useListSubjects,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  branchId: z.coerce.number().min(1, "Branch required"),
  classId: z.coerce.number().min(1, "Class required"),
  sectionId: z.coerce.number().optional(),
  subjectId: z.coerce.number().min(1, "Subject required"),
  academicYear: z.string().min(1, "Academic year required"),
  month: z.coerce.number().min(1).max(12),
  week: z.coerce.number().optional(),
  chapter: z.string().min(1, "Chapter required"),
  topic: z.string().min(1, "Topic required"),
  subtopic: z.string().optional(),
  expectedPeriods: z.coerce.number().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  learningOutcomes: z.string().optional(),
  teachingAids: z.string().optional(),
  activityPlan: z.string().optional(),
  assessmentPlan: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export default function SyllabusForm() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const editId = params.id ? parseInt(params.id, 10) : null;

  const { data: branchesData } = useListBranches();
  const { data: classesData } = useListClasses();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      academicYear: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`,
      month: new Date().getMonth() + 1,
    },
  });

  const classId = form.watch("classId");
  const { data: sectionsData } = useListSections(
    classId ? { classId } : undefined,
    {
      query: { enabled: !!classId, queryKey: ["sections", classId] },
    },
  );
  const { data: subjectsData } = useListSubjects(
    classId ? { classId } : undefined,
    {
      query: { enabled: !!classId, queryKey: ["subjects", classId] },
    },
  );

  const { data: existing } = useGetSyllabus(editId ?? 0, {
    query: { enabled: !!editId, queryKey: ["getSyllabus", editId] },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        branchId: existing.branchId,
        classId: existing.classId,
        sectionId: existing.sectionId ?? undefined,
        subjectId: existing.subjectId,
        academicYear: existing.academicYear,
        month: existing.month,
        week: existing.week ?? undefined,
        chapter: existing.chapter,
        topic: existing.topic,
        subtopic: existing.subtopic ?? undefined,
        expectedPeriods: existing.expectedPeriods ?? undefined,
        plannedStartDate: existing.plannedStartDate ?? undefined,
        plannedEndDate: existing.plannedEndDate ?? undefined,
        learningOutcomes: existing.learningOutcomes ?? undefined,
        teachingAids: existing.teachingAids ?? undefined,
        activityPlan: existing.activityPlan ?? undefined,
        assessmentPlan: existing.assessmentPlan ?? undefined,
      });
    }
  }, [existing, form]);

  const createMut = useCreateSyllabus();
  const updateMut = useUpdateSyllabus();

  function onSubmit(v: Values) {
    if (editId) {
      const {
        branchId: _b,
        classId: _c,
        sectionId: _s,
        subjectId: _sub,
        academicYear: _y,
        month: _m,
        week: _w,
        ...rest
      } = v;
      updateMut.mutate(
        { id: editId, data: rest },
        {
          onSuccess: () => {
            toast({ title: "Syllabus updated" });
            setLocation("/syllabus");
          },
          onError: (err: unknown) =>
            toast({
              title: "Update failed",
              description: (err as Error).message,
              variant: "destructive",
            }),
        },
      );
    } else {
      createMut.mutate(
        { data: v },
        {
          onSuccess: () => {
            toast({ title: "Syllabus submitted for review" });
            setLocation("/syllabus");
          },
          onError: (err: unknown) =>
            toast({
              title: "Submit failed",
              description: (err as Error).message,
              variant: "destructive",
            }),
        },
      );
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/syllabus")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {editId ? "Edit syllabus breakup" : "New syllabus breakup"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        disabled={!!editId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branchesData?.data?.map((b) => (
                            <SelectItem key={b.id} value={b.id.toString()}>
                              {b.name}
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
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        disabled={!!editId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classesData?.data?.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.name}
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
                  name="sectionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section (optional)</FormLabel>
                      <Select
                        value={field.value?.toString() ?? ""}
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        disabled={!!editId || !classId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All sections" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sectionsData?.data?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name}
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
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        disabled={!!editId || !classId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjectsData?.data?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name}
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
                  name="academicYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic year</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="2025-26"
                          {...field}
                          disabled={!!editId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month (1-12)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          {...field}
                          disabled={!!editId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="week"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedPeriods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected periods</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="chapter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chapter</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subtopic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtopic</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="plannedStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="plannedEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="learningOutcomes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning outcomes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="teachingAids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teaching aids</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="activityPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity plan</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assessmentPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assessment plan</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/syllabus")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {editId ? "Save changes" : "Submit for review"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
