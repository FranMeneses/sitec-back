CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    name VARCHAR
);

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
    idArea INTEGER REFERENCES area(id) NOT NULL
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
    idCategory UUID REFERENCES category(id),
    idUnit INTEGER REFERENCES unit(id)
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
    idMember UUID REFERENCES project_member(id),
    report text,
    idProcess UUID REFERENCES process(id) NOT NULL
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