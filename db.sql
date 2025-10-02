CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    name VARCHAR
);

INSERT INTO role (name) VALUES ('super_admin');
INSERT INTO role (name) VALUES ('admin');
INSERT INTO role (name) VALUES ('user');
INSERT INTO role (name) VALUES ('unit_member');
INSERT INTO role (name) VALUES ('project_member');
INSERT INTO role (name) VALUES ('process_member');
INSERT INTO role (name) VALUES ('task_member');
INSERT INTO role (name) VALUES ('area_member');

CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR,
    isActive BOOLEAN DEFAULT true,
    havePassword BOOLEAN DEFAULT false
);

CREATE TABLE type (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL
);

INSERT INTO type (name) VALUES ('Administrativa');
INSERT INTO type (name) VALUES ('Académica');

CREATE TABLE unit (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    idType INTEGER REFERENCES type(id)
);

CREATE TABLE area (
    id SERIAL PRIMARY KEY,
    name VARCHAR
);

CREATE TABLE category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    id_area INTEGER REFERENCES area(id) NOT NULL
);

CREATE TABLE unit_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idUser UUID REFERENCES "user"(id),
    idUnit INTEGER REFERENCES unit(id),
    idRole INTEGER REFERENCES role(id)
);

CREATE TABLE admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idArea INTEGER REFERENCES area(id),
    idUser UUID REFERENCES "user"(id)
);

CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    description TEXT,
    startDate TIMESTAMP,
    dueDate TIMESTAMP,
    editedAt TIMESTAMP,
    idEditor UUID REFERENCES "user"(id),
    idcategory UUID REFERENCES category(id),
    idunit INTEGER REFERENCES unit(id)
);

CREATE TABLE process (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    description VARCHAR,
    startDate TIMESTAMP,
    dueDate TIMESTAMP,
    editedAt TIMESTAMP,
    idEditor UUID REFERENCES "user"(id),
    idProject UUID REFERENCES project(id)
);

CREATE TABLE project_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idProject UUID REFERENCES project(id),
    idUser UUID REFERENCES "user"(id),
    idRole INTEGER REFERENCES role(id)
);

CREATE TABLE task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR,
    description TEXT,
    startDate TIMESTAMP,
    dueDateAt TIMESTAMP,
    status VARCHAR,
    editedAt TIMESTAMP,
    idEditor UUID REFERENCES "user"(id),
    idprocess UUID REFERENCES process(id) NOT NULL,
    report TEXT
);

CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idTask UUID REFERENCES task(id) NOT NULL,
    link TEXT NOT NULL,
    idUploader UUID REFERENCES "user"(id) NOT NULL,
    uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    idCreator UUID REFERENCES "user"(id) NOT NULL,
    idProject UUID REFERENCES project(id),
    idProcess UUID REFERENCES process(id),
    idTask UUID REFERENCES task(id)
);

CREATE TABLE comment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_user UUID REFERENCES "user"(id) NOT NULL,
    id_task UUID REFERENCES task(id) NOT NULL
);

CREATE TABLE task_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idtask UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    iduser UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    idrole Int NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(idtask, iduser)
);

CREATE TABLE system_role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role_id Int NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

ALTER TABLE evidence ADD COLUMN review TEXT;

ALTER TABLE task ADD COLUMN budget INT;

ALTER TABLE task ADD COLUMN expense INT;

ALTER TABLE task ADD COLUMN review TEXT;

ALTER TABLE process ADD COLUMN review TEXT;

ALTER TABLE project ADD COLUMN review TEXT;

CREATE TABLE area_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idarea INTEGER REFERENCES area(id) NOT NULL,
    iduser UUID REFERENCES "user"(id) NOT NULL
);

ALTER TABLE project ADD COLUMN status VARCHAR DEFAULT 'active';

ALTER TABLE unit ADD COLUMN idAdmin UUID REFERENCES admin(id);

ALTER TABLE project ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE project ADD COLUMN archived_by UUID REFERENCES "user"(id);

ALTER TABLE process ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE process ADD COLUMN archived_by UUID REFERENCES "user"(id);

ALTER TABLE task ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE task ADD COLUMN archived_by UUID REFERENCES "user"(id);

ALTER TABLE evidence ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE evidence ADD COLUMN archived_by UUID REFERENCES "user"(id);

CREATE INDEX idx_project_archived ON project(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_process_archived ON process(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_task_archived ON task(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_evidence_archived ON evidence(archived_at) WHERE archived_at IS NULL;