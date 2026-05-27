import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  usePreviewStudentImport,
  useConfirmStudentImport,
  useListBranches,
  type ImportError,
  type ImportPreviewResponseValidItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

type Row = Record<string, unknown>;

function parseCsv(text: string): Row[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const obj: Row = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? "";
    });
    return obj;
  });
}

const TEMPLATE_CSV =
  "admission_no,name,class,section,roll_no,father_name,mother_name,parent_contact,house\nADM001,Sample Student,Class 1,A,1,Father Name,Mother Name,9999999999,Red\n";

export default function StudentImport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [branchId, setBranchId] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [previewErrors, setPreviewErrors] = useState<ImportError[]>([]);
  const [validRows, setValidRows] = useState<ImportPreviewResponseValidItem[]>(
    [],
  );
  const [previewDone, setPreviewDone] = useState(false);

  const { data: branchesData } = useListBranches();
  const preview = usePreviewStudentImport();
  const confirm = useConfirmStudentImport();

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setPreviewDone(false);
    setPreviewErrors([]);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast({
          title: "Empty file",
          description: "No rows found.",
          variant: "destructive",
        });
        return;
      }
      setRows(parsed);
      toast({
        title: `${parsed.length} rows loaded`,
        description: "Click 'Validate' to preview.",
      });
    } catch (err) {
      toast({
        title: "Failed to read file",
        description: String((err as Error).message),
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const runPreview = () => {
    if (!branchId) {
      toast({ title: "Select a branch first", variant: "destructive" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: "Upload a CSV first", variant: "destructive" });
      return;
    }
    preview.mutate(
      { data: { rows, branchId: parseInt(branchId, 10) } },
      {
        onSuccess: (resp) => {
          setPreviewErrors(resp.errors);
          setValidRows(resp.valid);
          setPreviewDone(true);
        },
        onError: (err: unknown) => {
          toast({
            title: "Preview failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const runConfirm = () => {
    if (!branchId || validRows.length === 0) return;
    confirm.mutate(
      {
        data: {
          rows: validRows,
          branchId: parseInt(branchId, 10),
          filename: filename || "import.csv",
        },
      },
      {
        onSuccess: (resp) => {
          toast({
            title: "Import complete",
            description: `${resp.successRows} students imported (${resp.errorRows} errors).`,
          });
          setLocation("/students");
        },
        onError: (err: unknown) => {
          toast({
            title: "Import failed",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/students")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Import Students</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step 1 — Choose branch & upload file
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchesData?.data?.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CSV file</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplate}
                  title="Download template"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Columns: admission_no, name, class, section, roll_no,
                father_name, mother_name, parent_contact, house
              </p>
            </div>
          </div>

          {rows.length > 0 && (
            <Alert>
              <FileSpreadsheet className="w-4 h-4" />
              <AlertDescription>
                <strong>{rows.length}</strong> rows loaded from{" "}
                <code className="text-xs">{filename}</code>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              onClick={runPreview}
              disabled={!branchId || rows.length === 0 || preview.isPending}
            >
              <Upload className="w-4 h-4 mr-2" />
              {preview.isPending ? "Validating…" : "Validate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Step 2 — Review & confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {validRows.length}{" "}
                valid
              </Badge>
              <Badge variant="destructive" className="text-sm">
                <AlertCircle className="w-3 h-3 mr-1" /> {previewErrors.length}{" "}
                errors
              </Badge>
              <Badge variant="outline" className="text-sm">
                {rows.length} total
              </Badge>
            </div>

            {previewErrors.length > 0 && (
              <div className="border rounded-md overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-32">Field</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewErrors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell>
                          <code className="text-xs">{e.field ?? "-"}</code>
                        </TableCell>
                        <TableCell className="text-sm text-destructive">
                          {e.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewDone(false);
                  setRows([]);
                  setValidRows([]);
                  setPreviewErrors([]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Start over
              </Button>
              <Button
                onClick={runConfirm}
                disabled={validRows.length === 0 || confirm.isPending}
              >
                {confirm.isPending
                  ? "Importing…"
                  : `Confirm import (${validRows.length} students)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
