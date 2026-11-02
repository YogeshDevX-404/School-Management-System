import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Building2, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { TableSkeleton } from '@/components/shared/loading-states';
import { programsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function ProgramsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; name: string; code: string; duration: string; description: string }>({ name: '', code: '', duration: '', description: '' });
  const [delId, setDelId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const filtered = (data || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (edit.id) await programsApi.update(edit.id, { name: edit.name, code: edit.code, duration: edit.duration, description: edit.description });
      else await programsApi.create({ name: edit.name, code: edit.code, duration: edit.duration, description: edit.description });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); toast.success('Program saved'); setOpen(false); },
  });
  const delMut = useMutation({ mutationFn: programsApi.remove, onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); toast.success('Removed'); setDelId(null); } });

  return (
    <div>
      <PageHeader title="Programs" description="Manage academic programs and curricula" actions={<Button size="sm" onClick={() => { setEdit({ name: '', code: '', duration: '', description: '' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Program</Button>} />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search programs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6"><TableSkeleton /></div> : !filtered.length ? <EmptyState icon={Building2} title="No programs found" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Program</TableHead><TableHead>Code</TableHead><TableHead>Duration</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border hover:bg-muted/50">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="text-sm">{p.duration}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{p.description || '-'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit({ id: p.id, name: p.name, code: p.code, duration: p.duration, description: p.description || '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDelId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit.id ? 'Edit Program' : 'Add Program'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Program Name</Label><Input className="mt-1.5" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="CBSE Board" /></div>
            <div><Label>Code</Label><Input className="mt-1.5" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="CBSE" /></div>
            <div><Label>Duration</Label><Input className="mt-1.5" value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: e.target.value })} placeholder="12 years" /></div>
            <div><Label>Description</Label><Textarea className="mt-1.5" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove program?</AlertDialogTitle><AlertDialogDescription>This will remove the program.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => delId && delMut.mutate(delId)}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
