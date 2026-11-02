import { motion } from 'framer-motion';
import { ShieldCheck, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROLES } from '@/constants';
import { ALL_MODULES, MODULE_LABELS, ROLE_PERMISSIONS, type AccessLevel } from '@/lib/permissions';

export function PermissionsPage() {
  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Role-based access control matrix" />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Permission Matrix</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Module</TableHead>
                  {ROLES.map((r) => <TableHead key={r.value} className="text-center">{r.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_MODULES.filter((m) => m !== 'profile').map((mod) => (
                  <TableRow key={mod}>
                    <TableCell className="sticky left-0 bg-card font-medium">{MODULE_LABELS[mod]}</TableCell>
                    {ROLES.map((r) => {
                      const access: AccessLevel = ROLE_PERMISSIONS[r.value]?.[mod] ?? 'none';
                      return (
                        <TableCell key={r.value} className="text-center">
                          {access === 'full' && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success/15"><Check className="h-4 w-4 text-success" /></span>}
                          {access === 'read' && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-warning/15 text-xs font-bold text-warning">R</span>}
                          {access === 'none' && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted"><X className="h-4 w-4 text-muted-foreground" /></span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r, i) => (
          <motion.div key={r.value} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><ShieldCheck className="h-4 w-4 text-primary" /></div>
                  <div><p className="text-sm font-semibold">{r.label}</p></div>
                </div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
