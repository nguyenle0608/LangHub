-- ============================================================
-- RLS Policies for LangHub
-- ============================================================

-- ORGANIZATIONS
-- Any authenticated user can create an org (they become owner in next step)
CREATE POLICY "Authenticated users can create orgs"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can view their orgs"
  ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Owners and admins can update orgs"
  ON organizations FOR UPDATE TO authenticated
  USING (id IN (
    SELECT org_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Owners can delete orgs"
  ON organizations FOR DELETE TO authenticated
  USING (id IN (
    SELECT org_id FROM members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- PROJECTS
CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM members WHERE user_id = auth.uid()));

-- Note: member row is inserted BEFORE project in createProject(), so this check works
CREATE POLICY "Org owners and admins can create projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Org owners and admins can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Org owners can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- TRANSLATION KEYS
CREATE POLICY "Project members can view keys"
  ON translation_keys FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  ));

CREATE POLICY "Translators and above can create keys"
  ON translation_keys FOR INSERT TO authenticated
  WITH CHECK (project_id IN (
    SELECT p.id FROM projects p
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'translator')
  ));

CREATE POLICY "Translators and above can update keys"
  ON translation_keys FOR UPDATE TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'translator')
  ));

CREATE POLICY "Owners and admins can delete keys"
  ON translation_keys FOR DELETE TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  ));

-- TRANSLATIONS
CREATE POLICY "Project members can view translations"
  ON translations FOR SELECT TO authenticated
  USING (key_id IN (
    SELECT tk.id FROM translation_keys tk
    JOIN projects p ON p.id = tk.project_id
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid()
  ));

CREATE POLICY "Translators and above can insert translations"
  ON translations FOR INSERT TO authenticated
  WITH CHECK (key_id IN (
    SELECT tk.id FROM translation_keys tk
    JOIN projects p ON p.id = tk.project_id
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'translator')
  ));

CREATE POLICY "Translators and above can update translations"
  ON translations FOR UPDATE TO authenticated
  USING (key_id IN (
    SELECT tk.id FROM translation_keys tk
    JOIN projects p ON p.id = tk.project_id
    JOIN members m ON m.org_id = p.org_id
    WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'translator')
  ));
