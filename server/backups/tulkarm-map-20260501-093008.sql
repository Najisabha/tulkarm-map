--
-- PostgreSQL database dump
--

\restrict fBRbz217KWfXkecheEp9S9Xy4n5CH9fiOgYmzr0eDrwcw4p4AgZgrQJgavVGV9P

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(100),
    details jsonb DEFAULT '{}'::jsonb,
    actor_name character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activity_log OWNER TO postgres;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    emoji character varying(64) NOT NULL,
    color character varying(7) NOT NULL,
    sort_order integer DEFAULT 0
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: complex_units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complex_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complex_id uuid NOT NULL,
    floor_number integer NOT NULL,
    unit_number character varying(20) NOT NULL,
    child_place_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.complex_units OWNER TO postgres;

--
-- Name: complexes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.complexes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    complex_type character varying(20) DEFAULT 'residential'::character varying NOT NULL,
    floors_count integer DEFAULT 1 NOT NULL,
    units_per_floor integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT complexes_complex_type_check CHECK (((complex_type)::text = ANY ((ARRAY['residential'::character varying, 'commercial'::character varying])::text[])))
);


ALTER TABLE public.complexes OWNER TO postgres;

--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    place_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: house_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.house_details (
    place_id uuid NOT NULL,
    name character varying(255),
    house_number character varying(50),
    location_text character varying(255),
    description text,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.house_details OWNER TO postgres;

--
-- Name: media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    type character varying(10) NOT NULL,
    url text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT media_type_check CHECK (((type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying])::text[])))
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: place_attributes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    value_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT place_attributes_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'json'::character varying, 'date'::character varying])::text[])))
);


ALTER TABLE public.place_attributes OWNER TO postgres;

--
-- Name: place_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    emoji character varying(16),
    color character varying(32),
    sort_order integer DEFAULT 0 NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    place_type_id uuid NOT NULL
);


ALTER TABLE public.place_categories OWNER TO postgres;

--
-- Name: place_category_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_category_links (
    place_id uuid NOT NULL,
    main_category_id uuid,
    sub_category_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.place_category_links OWNER TO postgres;

--
-- Name: place_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_locations (
    place_id uuid NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.place_locations OWNER TO postgres;

--
-- Name: place_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    category_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    phone character varying(20),
    photos jsonb DEFAULT '[]'::jsonb,
    videos jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT place_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.place_requests OWNER TO postgres;

--
-- Name: place_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_tags (
    place_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.place_tags OWNER TO postgres;

--
-- Name: place_type_attribute_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_type_attribute_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_type_id uuid NOT NULL,
    key character varying(100) NOT NULL,
    label character varying(255) NOT NULL,
    value_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    is_required boolean DEFAULT false,
    options jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ptad_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'json'::character varying, 'date'::character varying, 'phone'::character varying])::text[])))
);


ALTER TABLE public.place_type_attribute_definitions OWNER TO postgres;

--
-- Name: place_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.place_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    emoji character varying(64),
    color character varying(32),
    sort_order integer DEFAULT 100 NOT NULL,
    kind character varying(32) DEFAULT 'other'::character varying NOT NULL,
    singular_label character varying(150),
    plural_label character varying(150),
    ui_labels jsonb DEFAULT '{}'::jsonb NOT NULL,
    flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT place_types_kind_check CHECK (((kind)::text = ANY ((ARRAY['house'::character varying, 'store'::character varying, 'residentialComplex'::character varying, 'commercialComplex'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.place_types OWNER TO postgres;

--
-- Name: places; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type_id uuid,
    created_by uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    owner_id uuid,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    phone_number character varying(30),
    CONSTRAINT places_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.places OWNER TO postgres;

--
-- Name: product_main_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_main_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    emoji character varying(16),
    arrow_color character varying(32)
);


ALTER TABLE public.product_main_categories OWNER TO postgres;

--
-- Name: product_sub_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_sub_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    main_category_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    emoji character varying(16),
    arrow_color character varying(32)
);


ALTER TABLE public.product_sub_categories OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    stock integer DEFAULT '-1'::integer NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    main_category character varying(100),
    sub_category character varying(100),
    company_name character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.ratings OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid,
    reported_by uuid,
    reason character varying(50) NOT NULL,
    details text,
    status character varying(20) DEFAULT 'pending'::character varying,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reports_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[])))
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    category_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    phone character varying(20),
    photos jsonb DEFAULT '[]'::jsonb,
    videos jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    owner_id uuid
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    phone_number character varying(30),
    date_of_birth date,
    profile_image_url text,
    id_card_image_url text,
    verification_status character varying(20) DEFAULT 'unverified'::character varying,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying, 'owner'::character varying, 'store_owner'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_log (id, action, entity_type, entity_id, details, actor_name, created_at) FROM stdin;
8a803a11-b969-4ef1-8ce3-5f22209629e5	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-26 18:32:52.153717+03
0f8dab85-dc4c-408b-ac0c-c151fbfad693	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-26 18:45:37.882011+03
4c18d341-d544-45d3-b2ab-31fe9be45cde	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-26 18:48:49.169597+03
ce143b11-4f20-4941-976e-a07a5d444620	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-26 18:48:49.557658+03
0573185a-97dd-4eee-9fd3-aea854a223e9	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-26 18:52:31.990935+03
8fc26b28-abd7-4202-b611-0d54d911ea3e	update	user	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	{"name": false, "role": false, "email": false}	\N	2026-04-27 11:29:17.180334+03
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (key, value, updated_at) FROM stdin;
maintenance_mode	false	2026-03-25 19:47:22.443765+02
welcome_message	"مرحباً بكم في خريطة طولكرم"	2026-03-25 19:47:22.443765+02
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, emoji, color, sort_order) FROM stdin;
41eb5c7c-5a7a-4225-8893-5e81d64cc4a5	مطعم	🍽️	#EF4444	5
2016e0d5-6479-4932-89b5-c7690e1864fc	مسجد	🕌	#10B981	6
5e1634f8-83b9-42d6-82c6-1665c4730dac	كنيسة	⛪	#8B5CF6	7
413e2bf9-90ce-4e05-a70b-1d514182bd86	موقف سيارات	🅿️	#F59E0B	8
872b09d8-6783-47c0-96cd-3ba5a3ee0c14	مكتب	🏢	#0EA5E9	9
2fe686f4-2ec2-437a-9d51-10c8ee1192e0	مستشفى	🏥	#DC2626	10
386583fc-1b6f-4611-8fb2-9a511ccc65c4	عيادة	⚕️	#F97316	11
cae09a2f-45b3-4636-b329-6d83377a4eca	صالون	💇	#EC4899	12
4d31d205-ecb2-4bc0-b54c-e37a707dd30c	مؤسسة تعليمية	🏫	#3B82F6	13
2b14eccf-80cd-43df-a8ae-10254225af02	مؤسسة حكومية	🏛️	#6B7280	14
36a40ccd-cb39-4ac9-b72b-f1c4832e79ac	منزل	🏠	#2E86AB	0
bf8a2351-aca9-4d76-8f30-171802fd1df0	متجر تجاري	🏪	#16A34A	1
997ca76f-ae52-4580-937f-a49e61fdbb08	مجمّع سكني	🏘️	#2563EB	2
76675c8b-b0ea-441a-8f76-e8734667ee0e	مجمّع تجاري	🏬	#F59E0B	3
313a56b5-0246-44d0-997f-32a640bd62ec	أخرى	📍	#6B7280	4
\.


--
-- Data for Name: complex_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complex_units (id, complex_id, floor_number, unit_number, child_place_id, created_at) FROM stdin;
2e4f2714-8d89-404c-8c26-b5bebe248540	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	2	\N	2026-04-07 18:02:42.742519+03
6f63f6c7-20d3-4e0b-b8c4-8f55b628284a	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	3	\N	2026-04-07 18:02:42.742519+03
dcb6880b-a33b-4cb0-bfb0-4048bfdf123e	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	4	\N	2026-04-07 18:02:42.742519+03
a17dedfb-3d61-4c92-a622-70e50d52fd9a	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	5	\N	2026-04-07 18:02:42.742519+03
a66bfa16-c0c5-4ec6-b804-661bb5e763a3	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	6	\N	2026-04-07 18:02:42.742519+03
bc62f99f-45ea-4e10-a47c-22403d0f62cf	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	7	\N	2026-04-07 18:02:42.742519+03
807cf5e5-822e-4c45-907a-34a115b37818	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	8	\N	2026-04-07 18:02:42.742519+03
1ce24fc7-60e6-40f5-aa49-e86de33e71f8	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	1	\N	2026-04-07 18:02:42.742519+03
b0e4d57c-4666-4c3d-993b-d0b9543b3cbf	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	2	\N	2026-04-07 18:02:42.742519+03
72993b75-9966-4b99-99f8-7f51fb0dd8cf	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	3	\N	2026-04-07 18:02:42.742519+03
5add8159-d4fe-4dc0-abc1-1842c2a2a52a	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	4	\N	2026-04-07 18:02:42.742519+03
6f09e20b-2eb8-4333-a976-bb716e624dd1	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	5	\N	2026-04-07 18:02:42.742519+03
d378db2a-9c12-40dc-a881-e883436516b2	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	6	\N	2026-04-07 18:02:42.742519+03
99c1b100-fa9d-4a3e-abf0-c1d9765fb733	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	7	\N	2026-04-07 18:02:42.742519+03
1e3eb16a-b2b7-402e-b6f2-ec0a883b938e	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	2	8	\N	2026-04-07 18:02:42.742519+03
aa433ca8-a27b-4abf-977a-d814b0d9b0dc	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	1	\N	2026-04-07 18:02:42.742519+03
e079e121-47ed-44f7-9678-ce386e8ba5dc	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	2	\N	2026-04-07 18:02:42.742519+03
096eac8e-1af1-4ba9-a318-d6fa49fe67d5	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	3	\N	2026-04-07 18:02:42.742519+03
d9ddf29a-ce8f-49d8-a7b3-d58a0edf907d	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	4	\N	2026-04-07 18:02:42.742519+03
923d49ea-0ea7-4cdf-b61a-a5d3429b3451	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	5	\N	2026-04-07 18:02:42.742519+03
80a3c202-b70e-489a-9b5b-eee01290b3a1	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	6	\N	2026-04-07 18:02:42.742519+03
dcf9eb63-97f0-475e-98ee-fed1d0f3f55f	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	7	\N	2026-04-07 18:02:42.742519+03
51b0ef71-4762-47cc-b422-7c64e550eb01	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	3	8	\N	2026-04-07 18:02:42.742519+03
757b94a9-90b5-411b-82ae-eb06f5249de1	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	1	\N	2026-04-07 18:02:42.742519+03
463445bd-73aa-4185-ae4d-eefa11b394e8	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	2	\N	2026-04-07 18:02:42.742519+03
85a97321-b4d2-4c33-8f16-6c686cdaba24	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	3	\N	2026-04-07 18:02:42.742519+03
dbd9cb5b-46b3-47a3-8a69-1bf2616f42e8	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	4	\N	2026-04-07 18:02:42.742519+03
8ccfb4a8-34e4-4a17-a32d-714420f50444	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	5	\N	2026-04-07 18:02:42.742519+03
d87654df-01ea-4f93-bab7-a612abef33ee	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	6	\N	2026-04-07 18:02:42.742519+03
577608f3-4964-4244-a097-213d14f3dd9a	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	7	\N	2026-04-07 18:02:42.742519+03
ab684cf0-74b7-479d-905e-30285b0cf0c8	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	4	8	\N	2026-04-07 18:02:42.742519+03
aee1cbb3-ce9f-4c0b-8084-50bce8e3e26d	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	1	2	\N	2026-04-07 18:10:48.295753+03
ce690aaf-ea58-4ae3-8038-658c1e19cf82	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	1	3	\N	2026-04-07 18:10:48.295753+03
1e2bc1d8-cede-488d-8044-321ccc699495	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	1	4	\N	2026-04-07 18:10:48.295753+03
d304f20a-5703-4ed9-a4c7-8a9a146ff4c1	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	2	1	\N	2026-04-07 18:10:48.295753+03
8c150019-5b84-4422-bca2-581629e96d0b	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	2	2	\N	2026-04-07 18:10:48.295753+03
e296165a-f2b4-423c-af61-3d3c5aab9711	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	2	3	\N	2026-04-07 18:10:48.295753+03
76869978-faef-4b03-939d-dc6b112a7ab1	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	2	4	\N	2026-04-07 18:10:48.295753+03
8456a40d-a917-4ee8-82a6-8496f4fa9e44	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	3	1	\N	2026-04-07 18:10:48.295753+03
f83ea8a6-f987-4021-88da-0db5ec143096	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	3	2	\N	2026-04-07 18:10:48.295753+03
f501ca44-8109-4245-aea4-1d6577ab68eb	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	3	3	\N	2026-04-07 18:10:48.295753+03
c847eda8-cc60-4055-b7d4-65e6ee2de312	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	3	4	\N	2026-04-07 18:10:48.295753+03
1725e8b8-59b5-4dce-9432-76c9815acf6c	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	4	1	\N	2026-04-07 18:10:48.295753+03
c0fe45e2-1307-4046-8f47-2841148ef37d	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	4	2	\N	2026-04-07 18:10:48.295753+03
2f10d230-968d-4649-926e-006fbc775574	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	4	3	\N	2026-04-07 18:10:48.295753+03
8c1f40f8-c2dd-4e70-a0e5-631e29b84056	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	4	4	\N	2026-04-07 18:10:48.295753+03
96d94caa-942d-4fad-a877-fb02655f6f69	496f1631-1c9b-4bf2-8633-ec4e3cec2b60	1	1	b1a19b7f-93d8-4f5b-9e56-ac709829cb0b	2026-04-07 17:49:57.13665+03
782fe27c-b739-416a-875b-bc29f825fcd2	0b6b9b86-15ed-4de8-85bb-6b5bbc299827	1	1	0fed3f8b-a96e-46df-973f-51688ae0bc58	2026-04-07 18:10:18.06706+03
a77492b6-ed53-4b77-ac1a-c919aca74026	6073ee2b-547b-4f70-a3ec-7792c15b7477	1	1	\N	2026-04-19 12:57:51.578119+03
7d38b54c-e104-4e4f-9a3c-80132bb0263d	6073ee2b-547b-4f70-a3ec-7792c15b7477	2	1	\N	2026-04-19 21:02:00.350979+03
3f9eb345-0ac3-491b-b74f-deb5fd329338	6073ee2b-547b-4f70-a3ec-7792c15b7477	3	1	\N	2026-04-19 21:02:00.350979+03
a275667f-6a15-4d3d-b8ce-971ab0db1d86	6073ee2b-547b-4f70-a3ec-7792c15b7477	4	1	\N	2026-04-19 21:02:00.350979+03
\.


--
-- Data for Name: complexes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.complexes (id, place_id, complex_type, floors_count, units_per_floor, created_at, updated_at) FROM stdin;
0b6b9b86-15ed-4de8-85bb-6b5bbc299827	daa70f60-bd46-4670-aee2-9854d1beefad	commercial	4	4	2026-04-07 18:10:18.065424+03	2026-04-19 22:10:35.472834+03
496f1631-1c9b-4bf2-8633-ec4e3cec2b60	02b6fe86-9a3b-49fe-8aad-74caaa0e2540	residential	4	8	2026-04-07 17:49:57.134759+03	2026-04-19 22:37:08.8585+03
6073ee2b-547b-4f70-a3ec-7792c15b7477	ee209d7f-c7fe-4ce3-a375-82b96aaea845	commercial	4	1	2026-04-19 12:57:51.562758+03	2026-04-19 22:53:52.047163+03
\.


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.favorites (user_id, place_id, created_at) FROM stdin;
\.


--
-- Data for Name: house_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.house_details (place_id, name, house_number, location_text, description, image_url, created_at, updated_at) FROM stdin;
c1755472-e189-4ed9-91a4-81e4430f9057	منزل المهندس ناجي	0598134332	\N	\N	\N	2026-03-25 20:26:04.593612+02	2026-03-25 20:26:04.593612+02
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media (id, place_id, type, url, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: place_attributes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_attributes (id, place_id, key, value, value_type, created_at, updated_at) FROM stdin;
38e9bb51-c0f2-4cc2-ba74-c4569a876545	c1755472-e189-4ed9-91a4-81e4430f9057	house_number	0598134332	string	2026-03-25 20:26:04.5878+02	2026-03-25 20:26:04.5878+02
036b7e3a-c63a-46ef-b070-a1dcdf857f4a	617526c3-7df6-43ea-8fa6-257b13bb1e5c	store_type	ملابس	string	2026-03-25 21:24:11.409002+02	2026-03-25 21:24:11.409002+02
8df5edd8-a11b-4295-bc9c-acdaad384e9c	617526c3-7df6-43ea-8fa6-257b13bb1e5c	store_category	رجالي	string	2026-03-25 21:24:11.411467+02	2026-03-25 21:24:11.411467+02
123cdc84-01b7-4a86-8170-0987310e0ca1	617526c3-7df6-43ea-8fa6-257b13bb1e5c	store_number	059999999	string	2026-03-25 21:24:11.412251+02	2026-03-25 21:24:11.412251+02
\.


--
-- Data for Name: place_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_categories (id, name, emoji, color, sort_order, parent_id, created_at, updated_at, place_type_id) FROM stdin;
a184a732-1d45-494b-9ccb-daf2970b4e57	عائلية	👪	#F59E0B	0	\N	2026-04-06 23:39:43.39893+03	2026-04-06 23:39:43.39893+03	435d4e0c-4566-47eb-b9ba-cc510e93ffb0
aa86ee77-f021-4a89-9e25-24f06401ef4a	ملابس	👕	#16A34A	0	\N	2026-04-07 00:03:16.845861+03	2026-04-07 00:03:16.845861+03	53359cd3-c059-413e-bba0-5a4d5cc56788
5a593dc9-b1b5-47ef-a611-e664c51a1f76	رجالي	👨‍🦲	#F59E0B	0	aa86ee77-f021-4a89-9e25-24f06401ef4a	2026-04-07 00:04:05.853235+03	2026-04-07 00:04:05.853235+03	53359cd3-c059-413e-bba0-5a4d5cc56788
fc91e184-3887-4288-a588-c17a75b275ef	نسائي	👩	#F59E0B	0	aa86ee77-f021-4a89-9e25-24f06401ef4a	2026-04-07 00:04:36.325131+03	2026-04-07 00:04:36.325131+03	53359cd3-c059-413e-bba0-5a4d5cc56788
5cd23bd9-bee3-443f-b1a2-8a6375a0b295	بيتزا	🍕	#F59E0B	0	a184a732-1d45-494b-9ccb-daf2970b4e57	2026-04-11 14:14:03.365905+03	2026-04-11 14:14:03.365905+03	435d4e0c-4566-47eb-b9ba-cc510e93ffb0
c2cc458a-aa95-47a0-a4c4-e29aa89a7c8b	برجر	🍔	#7C3AED	0	a184a732-1d45-494b-9ccb-daf2970b4e57	2026-04-11 14:14:23.239731+03	2026-04-11 14:14:23.239731+03	435d4e0c-4566-47eb-b9ba-cc510e93ffb0
f4a85d5a-2192-48dc-8802-7b26d4a98f65	جامعة	🕌	#16A34A	0	\N	2026-04-13 11:07:00.583679+03	2026-04-13 11:07:00.583679+03	6519089d-a9e2-4379-a4c5-825b82526f46
dbe577fe-c50f-4cb5-8871-76bee7f23ca7	جامعة حكومية	🕌	#16A34A	0	f4a85d5a-2192-48dc-8802-7b26d4a98f65	2026-04-13 11:08:21.172628+03	2026-04-19 21:19:42.161043+03	6519089d-a9e2-4379-a4c5-825b82526f46
562ff57f-d3af-46ca-b453-78f3c5399639	جامعة خاصة	🕌	#2E86AB	0	f4a85d5a-2192-48dc-8802-7b26d4a98f65	2026-04-19 21:19:32.5034+03	2026-04-19 21:19:45.516962+03	6519089d-a9e2-4379-a4c5-825b82526f46
58dabd58-0f14-414c-9562-0435c4a1c79f	رجالي	👨	#16A34A	0	\N	2026-04-19 22:01:15.238499+03	2026-04-19 22:01:15.238499+03	5309e45c-2231-4469-ac33-83057821c616
caf9b234-b74a-4b95-9c7c-4e8d105c7148	خاص	\N	#2E86AB	0	\N	2026-04-19 22:22:38.681272+03	2026-04-19 22:22:38.681272+03	319c6711-62a6-41fd-b130-e41e6b83b42e
81fd2e49-d858-487c-99ed-08938ad17827	حكومي	\N	#2E86AB	0	\N	2026-04-19 22:22:46.433134+03	2026-04-19 22:22:46.433134+03	319c6711-62a6-41fd-b130-e41e6b83b42e
706f0250-b82b-4bd3-af2b-471a2d3a3910	هندسية	\N	#2E86AB	0	\N	2026-04-19 22:23:28.16009+03	2026-04-19 22:23:28.16009+03	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3
73d38982-a1a5-446e-a355-fd7f96bac9ea	محاماه	\N	#2E86AB	0	\N	2026-04-19 22:23:33.702145+03	2026-04-19 22:23:33.702145+03	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3
\.


--
-- Data for Name: place_category_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_category_links (place_id, main_category_id, sub_category_id, created_at, updated_at) FROM stdin;
a22e1b5d-6d55-4d79-a7ac-25fbb4939070	aa86ee77-f021-4a89-9e25-24f06401ef4a	fc91e184-3887-4288-a588-c17a75b275ef	2026-04-07 00:23:41.881912+03	2026-04-07 00:23:41.881912+03
1b6343a2-f8e9-41ad-9851-bca98b1f164a	a184a732-1d45-494b-9ccb-daf2970b4e57	c2cc458a-aa95-47a0-a4c4-e29aa89a7c8b	2026-04-27 11:28:21.41334+03	2026-04-27 12:53:00.086229+03
\.


--
-- Data for Name: place_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_locations (place_id, latitude, longitude, created_at, updated_at) FROM stdin;
c1755472-e189-4ed9-91a4-81e4430f9057	32.3100749	35.1133273	2026-03-25 20:26:04.583537+02	2026-03-25 20:26:04.583537+02
617526c3-7df6-43ea-8fa6-257b13bb1e5c	32.3102588	35.1132346	2026-03-25 21:24:11.404824+02	2026-03-25 21:24:11.404824+02
e5fe2b0f-6e06-4f4e-b691-7cc49fb70a96	32.3077733	35.0282710	2026-04-05 17:53:38.235461+03	2026-04-05 18:01:06.666414+03
b0f94e05-e511-47f9-a58c-4351d0a76f80	32.3078700	35.0286000	2026-04-06 23:22:00.763132+03	2026-04-06 23:22:00.763132+03
a22e1b5d-6d55-4d79-a7ac-25fbb4939070	32.3079693	35.0292092	2026-04-07 00:22:21.30334+03	2026-04-07 00:23:41.879576+03
02b6fe86-9a3b-49fe-8aad-74caaa0e2540	32.3120794	35.0301405	2026-04-07 17:49:57.130005+03	2026-04-07 17:49:57.130005+03
daa70f60-bd46-4670-aee2-9854d1beefad	32.3111223	35.0301306	2026-04-07 18:10:18.061294+03	2026-04-07 18:10:18.061294+03
74862dc6-7775-45fa-9640-0ab7952d5474	32.3120794	35.0301405	2026-04-07 18:17:35.097697+03	2026-04-07 18:17:35.097697+03
b1a19b7f-93d8-4f5b-9e56-ac709829cb0b	32.3120794	35.0301405	2026-04-07 18:26:14.462742+03	2026-04-07 18:26:14.462742+03
0fed3f8b-a96e-46df-973f-51688ae0bc58	32.3111223	35.0301306	2026-04-11 14:15:03.247559+03	2026-04-11 14:15:03.247559+03
2c5d085e-07b8-48bc-9978-945770ec3e7c	32.3175797	35.0316883	2026-04-19 12:24:14.959811+03	2026-04-19 12:24:14.959811+03
dc2d53c9-d9f8-415e-ad21-7df872d599fd	32.3175739	35.0319138	2026-04-19 13:02:42.310761+03	2026-04-19 13:02:42.310761+03
ee209d7f-c7fe-4ce3-a375-82b96aaea845	32.3172853	35.0299015	2026-04-19 12:57:51.53491+03	2026-04-19 21:02:05.500712+03
1b6343a2-f8e9-41ad-9851-bca98b1f164a	32.3179000	35.0316154	2026-04-27 11:27:20.422402+03	2026-04-27 12:53:00.081264+03
\.


--
-- Data for Name: place_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_requests (id, name, description, category_id, latitude, longitude, phone, photos, videos, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: place_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_tags (place_id, tag_id) FROM stdin;
\.


--
-- Data for Name: place_type_attribute_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_type_attribute_definitions (id, place_type_id, key, label, value_type, is_required, options, created_at, updated_at) FROM stdin;
c19894c0-97f2-4819-9fbf-379b7d048637	467e0014-6324-408a-a3e4-db09b7b561e5	complex_number	رقم المجمع	string	t	\N	2026-04-19 21:32:05.648327+03	2026-04-19 21:32:05.648327+03
102acb52-7ac9-440e-aa78-d11a803d10a6	5309e45c-2231-4469-ac33-83057821c616	store_type	التصنيف الرئيسي للصالون	string	t	\N	2026-04-19 21:32:16.25421+03	2026-04-19 21:32:16.25421+03
21565e4d-399c-423a-9b0f-d07fadfd91bd	5309e45c-2231-4469-ac33-83057821c616	store_category	التصنيف الفرعي للصالون	string	t	\N	2026-04-19 21:32:16.260911+03	2026-04-19 21:32:16.260911+03
04f498ed-a0cb-43cd-82bf-7cc1c53327d2	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	store_type	التصنيف الرئيسي للعيادة	string	t	\N	2026-04-19 21:33:31.2968+03	2026-04-19 21:33:31.2968+03
97f7a490-86d5-43df-a025-125935a3bdd7	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	store_category	التصنيف الفرعي للعيادة	string	t	\N	2026-04-19 21:33:31.311716+03	2026-04-19 21:33:31.311716+03
51ce4aca-5767-4de3-bbe3-380b536191cc	86cfdde5-8748-4cc8-8dfc-c9092d7d1fff	house_number	رقم المنزل	string	t	\N	2026-04-19 21:34:02.374768+03	2026-04-19 21:34:02.374768+03
6b85276d-ab7b-43f0-aa15-9f7bc5310bce	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 21:47:21.460923+03	2026-04-19 21:47:21.460923+03
baebe990-b83e-4584-bd29-8288af70fdad	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	place_name	اسم عيادة	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 21:47:21.467865+03	2026-04-19 21:47:21.467865+03
bc976f3a-9d16-452b-9a4d-6d49d8f72597	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	place_photos	صور العيادة	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-19 21:47:21.483835+03	2026-04-19 21:47:21.483835+03
eaf1cc3c-7af9-4efd-aa68-8f634d93fb1b	cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	place_description	الوصف	string	t	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 21:47:21.476294+03	2026-04-19 21:49:28.014939+03
cc6b12db-ee21-4ab5-9788-2f94f1bb0b9f	53359cd3-c059-413e-bba0-5a4d5cc56788	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 21:53:29.281257+03	2026-04-19 21:53:29.281257+03
aab2993e-a520-42a6-8cf0-644e44eb4ba6	53359cd3-c059-413e-bba0-5a4d5cc56788	place_name	اسم متجر تجاري	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 21:53:29.29965+03	2026-04-19 21:53:29.29965+03
dc145b44-3192-4f6c-a6ba-a23654b63a02	53359cd3-c059-413e-bba0-5a4d5cc56788	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 21:53:29.30646+03	2026-04-19 21:53:29.30646+03
181c037d-6ce1-4ffa-a454-b8951d28a9c5	53359cd3-c059-413e-bba0-5a4d5cc56788	place_photos	صور المتجر	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-19 21:53:29.315293+03	2026-04-19 21:53:29.315293+03
ca32b936-9c32-4bf9-88f0-1a3a72821d7a	53359cd3-c059-413e-bba0-5a4d5cc56788	store_type	التصنيف الرئيسي‌ للمتجر	string	t	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-19 21:53:29.326224+03	2026-04-19 21:53:29.326224+03
a4188924-de4e-4673-8426-2a67e12f0658	53359cd3-c059-413e-bba0-5a4d5cc56788	store_category	التصنيف الفرعي‌ للمتجر	string	t	{"uiRole": "dynamic", "sortOrder": 110}	2026-04-19 21:53:29.334261+03	2026-04-19 21:53:29.334261+03
cb1b91b2-54bf-410a-bbee-0868dec468e5	5309e45c-2231-4469-ac33-83057821c616	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 22:00:48.750702+03	2026-04-19 22:00:48.750702+03
0312a5a8-f6fd-4a1b-8e15-d72255e3b1c6	5309e45c-2231-4469-ac33-83057821c616	place_name	اسم صالون	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 22:00:48.762356+03	2026-04-19 22:00:48.762356+03
190bfca0-d25d-4493-bc7d-bd2de5a07b90	5309e45c-2231-4469-ac33-83057821c616	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 22:00:48.768666+03	2026-04-19 22:00:48.768666+03
62f250fc-0098-4b76-ad0d-aac3e5f4911a	5309e45c-2231-4469-ac33-83057821c616	place_photos	صور الصالون	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-19 22:00:48.774695+03	2026-04-19 22:00:48.774695+03
e26813e7-8f06-4ef7-817d-821ec500ac7a	d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 22:10:03.324477+03	2026-04-19 22:10:03.324477+03
0be323eb-7ae4-4137-9485-b955fa77a378	d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	place_name	اسم أخرى	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 22:10:03.337612+03	2026-04-19 22:10:03.337612+03
fd3f80a1-8fe6-45a5-9d68-081be395e77d	d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 22:10:03.344936+03	2026-04-19 22:10:03.344936+03
02a18651-cc0e-49cb-904a-ef01f46f87af	d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	location_text	وصف الموقع	string	f	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-19 22:10:03.366396+03	2026-04-19 22:10:03.366396+03
f7269507-5700-4580-aa4b-dba2af7d9d5d	319c6711-62a6-41fd-b130-e41e6b83b42e	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 22:22:20.900614+03	2026-04-19 22:22:20.900614+03
3399be1b-18b5-46f1-a2e4-9512884544b6	319c6711-62a6-41fd-b130-e41e6b83b42e	place_name	اسم مستشفى	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 22:22:20.910245+03	2026-04-19 22:22:20.910245+03
d72da55f-80f6-47ba-b3fc-82376f5f31c8	319c6711-62a6-41fd-b130-e41e6b83b42e	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 22:22:20.916176+03	2026-04-19 22:22:20.916176+03
816e3155-ea82-466c-810c-b102857d29eb	319c6711-62a6-41fd-b130-e41e6b83b42e	place_photos	صور المستشفى	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-19 22:22:20.922685+03	2026-04-19 22:22:20.922685+03
3cdab055-b7ad-49c8-8581-e3eda6db9d7c	319c6711-62a6-41fd-b130-e41e6b83b42e	store_type	التصنيف الرئيسي للمستشفى	string	t	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-19 22:22:20.929305+03	2026-04-19 22:22:20.929305+03
921ed8f1-50ae-4995-a4a0-75ebf73980ca	319c6711-62a6-41fd-b130-e41e6b83b42e	store_category	التصنيف الفرعي للمستشفى	string	t	{"uiRole": "dynamic", "sortOrder": 110}	2026-04-19 22:22:20.93551+03	2026-04-19 22:22:20.93551+03
c244f1f8-9e5c-41c5-acdb-965bef7927fe	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-19 22:23:19.211939+03	2026-04-19 22:23:19.211939+03
8740cf8d-4548-4bff-8b69-a18f4ba6c25f	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	place_name	اسم مكتب	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-19 22:23:19.22332+03	2026-04-19 22:23:19.22332+03
671ca95c-2c60-4f27-8c6e-717dc5f94c92	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-19 22:23:19.229932+03	2026-04-19 22:23:19.229932+03
6208e870-c4fa-4287-8504-9a38ca82099b	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	place_photos	صور المكتب	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-19 22:23:19.23522+03	2026-04-19 22:23:19.23522+03
89c5af51-6e4f-46d7-9b43-1350c3460f0b	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	store_type	التصنيف الرئيسي للمكتب	string	t	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-19 22:23:19.241667+03	2026-04-19 22:23:19.241667+03
bbcea457-7a3b-430d-88fe-baad80b4f533	d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	store_category	التصنيف الفرعي للمكتب	string	t	{"uiRole": "dynamic", "sortOrder": 110}	2026-04-19 22:23:19.246957+03	2026-04-19 22:23:19.246957+03
2246c086-4cea-4711-b3bc-817d22746862	f94792b4-6cfc-4dcb-bb83-f3c4525dd234	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-26 16:01:01.67859+03	2026-04-26 16:01:01.67859+03
0ea6204c-170f-4e2d-ba46-aecf270d5d6f	f94792b4-6cfc-4dcb-bb83-f3c4525dd234	place_name	اسم أخرى	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-26 16:01:01.693957+03	2026-04-26 16:01:01.693957+03
35b2931a-a76e-4839-bc34-f3f57e1b6e59	f94792b4-6cfc-4dcb-bb83-f3c4525dd234	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-26 16:01:01.70637+03	2026-04-26 16:01:01.70637+03
46b78fa5-8064-450d-a3d1-21d274e21768	f94792b4-6cfc-4dcb-bb83-f3c4525dd234	place_phone	رقم الهاتف	phone	f	{"uiRole": "place_phone", "sortOrder": 30}	2026-04-26 16:01:01.716699+03	2026-04-26 16:01:01.716699+03
5c022c10-f757-42cb-afe1-c1dfe2603934	f94792b4-6cfc-4dcb-bb83-f3c4525dd234	location_text	وصف الموقع	string	f	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-26 16:01:01.73824+03	2026-04-26 16:01:01.73824+03
91032fa4-65e8-4708-a4e0-ded880e21a08	6519089d-a9e2-4379-a4c5-825b82526f46	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-26 16:02:42.842967+03	2026-04-26 16:02:42.842967+03
f2205a80-08de-4e63-b145-d400067a59f9	6519089d-a9e2-4379-a4c5-825b82526f46	place_name	اسم أخرى	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-26 16:02:42.852534+03	2026-04-26 16:02:42.852534+03
f3e9e4e5-dd35-487f-9c36-954ab4cdb647	6519089d-a9e2-4379-a4c5-825b82526f46	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-26 16:02:42.858097+03	2026-04-26 16:02:42.858097+03
90e02407-6ff9-4f7f-a443-44b37636ed9f	6519089d-a9e2-4379-a4c5-825b82526f46	place_phone	رقم الهاتف	phone	f	{"uiRole": "place_phone", "sortOrder": 30}	2026-04-26 16:02:42.863302+03	2026-04-26 16:02:42.863302+03
1930c346-1424-462e-a3d6-5236d6cc2c90	6519089d-a9e2-4379-a4c5-825b82526f46	location_text	وصف الموقع	string	f	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-26 16:02:42.868787+03	2026-04-26 16:02:42.868787+03
38b8807b-753f-4c69-b94d-9ee493b86125	0da16d20-66bd-4117-ad48-9790a3f34309	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-26 16:08:50.911384+03	2026-04-26 16:08:50.911384+03
3328d19f-eba1-4b50-8321-ccdf894e103d	0da16d20-66bd-4117-ad48-9790a3f34309	place_name	اسم أخرى	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-26 16:08:50.932637+03	2026-04-26 16:08:50.932637+03
84feb341-4e98-4e69-bab6-0ca08b48294d	0da16d20-66bd-4117-ad48-9790a3f34309	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-26 16:08:50.945312+03	2026-04-26 16:08:50.945312+03
c8f307b9-8295-4293-9d66-6db7d210e9ab	0da16d20-66bd-4117-ad48-9790a3f34309	place_phone	رقم الهاتف	phone	f	{"uiRole": "place_phone", "sortOrder": 30}	2026-04-26 16:08:50.962165+03	2026-04-26 16:08:50.962165+03
ae0c0b68-34af-49e5-9398-b55483241580	0da16d20-66bd-4117-ad48-9790a3f34309	location_text	وصف الموقع	string	f	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-26 16:08:50.975755+03	2026-04-26 16:08:50.975755+03
6acc4202-7101-4be5-aa2c-734311bd3498	6519089d-a9e2-4379-a4c5-825b82526f46	place_photos	صور المؤسسة التعليمية	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-26 16:10:02.748728+03	2026-04-26 16:10:02.748728+03
dd64e3b1-e0c2-444b-820d-df8f8b69b42c	6519089d-a9e2-4379-a4c5-825b82526f46	store_type	التصنيف الرئيسي للمؤسسة التعليمية	string	t	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-26 16:10:02.760101+03	2026-04-26 16:10:02.760101+03
594c6373-fc80-4003-9da3-2c0a1a508941	6519089d-a9e2-4379-a4c5-825b82526f46	store_category	التصنيف الفرعي للمؤسسة التعليمية	string	t	{"uiRole": "dynamic", "sortOrder": 110}	2026-04-26 16:10:02.767999+03	2026-04-26 16:10:02.767999+03
c30326f5-a046-409b-a3e3-061b0c169a13	6519089d-a9e2-4379-a4c5-825b82526f46	store_number	رقم هاتف المؤسسة التعليمية	phone	t	{"uiRole": "dynamic", "sortOrder": 120}	2026-04-26 16:10:02.774807+03	2026-04-26 16:10:02.774807+03
096aa1f9-d5b4-47a2-9269-354fa03dc60b	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	place_location	الموقع على الخريطة	json	t	{"uiRole": "place_location", "sortOrder": 5}	2026-04-27 11:28:05.381309+03	2026-04-27 11:28:05.381309+03
e52648ff-b2c2-4742-92a9-89af0378ebee	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	place_name	اسم المطعم	string	t	{"uiRole": "place_name", "sortOrder": 10}	2026-04-27 11:28:05.415329+03	2026-04-27 11:28:05.415329+03
4b5449ef-434d-4f02-973f-94582170c8bb	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	place_description	الوصف	string	f	{"uiRole": "place_description", "sortOrder": 20}	2026-04-27 11:28:05.425764+03	2026-04-27 11:28:05.425764+03
848aa89e-7fa6-49d5-92b7-b6280034fc18	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	place_photos	صور المطعم	json	f	{"uiRole": "place_photos", "maxPhotos": 3, "sortOrder": 900}	2026-04-27 11:28:05.438739+03	2026-04-27 11:28:05.438739+03
9724e0a2-476c-4394-8834-27a03caa51f3	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	store_type	التصنيف الرئيسي للمطعم	string	t	{"uiRole": "dynamic", "sortOrder": 100}	2026-04-27 11:28:05.45273+03	2026-04-27 11:28:05.45273+03
ea1d841c-2d7c-40b6-9305-102a8e87a169	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	store_category	التصنيف الفرعي للمطعم	string	t	{"uiRole": "dynamic", "sortOrder": 110}	2026-04-27 11:28:05.471528+03	2026-04-27 11:28:05.471528+03
0ef7bc59-3514-4b3f-bb02-aa01c7e464b8	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	store_number	رقم هاتف المطعم	phone	t	{"uiRole": "dynamic", "sortOrder": 120}	2026-04-27 11:28:05.496386+03	2026-04-27 11:28:05.496386+03
9f60f63b-aa3f-4f41-8f94-b51523671900	d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	place_phone	رقم الهاتف	phone	f	{"uiRole": "place_phone", "sortOrder": 30}	2026-04-27 15:55:50.624853+03	2026-04-27 15:55:50.624853+03
\.


--
-- Data for Name: place_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.place_types (id, name, created_at, updated_at, emoji, color, sort_order, kind, singular_label, plural_label, ui_labels, flags, aliases) FROM stdin;
1b0e94b1-00ff-4b22-84d2-b2a376e6d2d5	عيادة	2026-04-26 20:07:58.679386+03	2026-04-26 20:07:58.746846+03	⚕️	#F97316	11	store	عيادة	العيادات	{"photosLabel": "صور العيادة", "nameFieldLabel": "اسم العيادة", "phoneFieldLabel": "رقم هاتف العيادة", "subCategoryLabel": "التصنيف الفرعي للعيادة", "mainCategoryLabel": "التصنيف الرئيسي للعيادة", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["عيادات"]
74d820f7-411e-479c-8094-304fa86936ef	صالون	2026-04-26 20:07:58.679386+03	2026-04-26 20:07:58.746846+03	💇	#EC4899	12	store	صالون	الصالونات	{"photosLabel": "صور الصالون", "nameFieldLabel": "اسم الصالون", "phoneFieldLabel": "رقم هاتف الصالون", "subCategoryLabel": "التصنيف الفرعي للصالون", "mainCategoryLabel": "التصنيف الرئيسي للصالون", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["صالونات"]
cc4fdbd8-a150-4b77-9074-e39a6c09e6b6	عيادات	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	⚕️	#F97316	11	other	عيادات	عيادات	{"descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{}	[]
86cfdde5-8748-4cc8-8dfc-c9092d7d1fff	منزل	2026-03-25 19:47:23.166377+02	2026-04-26 20:07:58.746846+03	🏠	#2E86AB	1	house	منزل	المنازل	{"attrLabels": {"house_number": "رقم المنزل"}, "photosLabel": "صور المنزل", "nameFieldLabel": "اسم صاحب المنزل", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": false}	[]
8f221dc7-3a25-4e5e-9ff6-6d588a79915f	كنيسة	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	⛪	#8B5CF6	7	other	كنيسة	الكنائس	{"attrLabels": {"location_text": "وصف الموقع"}, "photosLabel": "صور الكنيسة", "nameFieldLabel": "اسم الكنيسة", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": false}	[]
5309e45c-2231-4469-ac33-83057821c616	صالونات	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	💇	#EC4899	12	other	صالونات	صالونات	{"descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{}	[]
435d4e0c-4566-47eb-b9ba-cc510e93ffb0	مطعم	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🍽️	#EF4444	5	store	مطعم	المطاعم	{"photosLabel": "صور المطعم", "nameFieldLabel": "اسم المطعم", "phoneFieldLabel": "رقم هاتف المطعم", "subCategoryLabel": "التصنيف الفرعي للمطعم", "mainCategoryLabel": "التصنيف الرئيسي للمطعم", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["مطاعم"]
4dbd8a9d-e415-45fa-8c2c-992e3bfc1c06	مؤسسة حكومية	2026-04-26 16:20:06.42497+03	2026-04-26 20:07:58.746846+03	🏛️	#6B7280	14	other	مؤسسة حكومية	المؤسسات الحكومية	{"photosLabel": "صور المؤسسة الحكومية", "nameFieldLabel": "اسم المؤسسة الحكومية", "phoneFieldLabel": "رقم هاتف المؤسسة الحكومية", "subCategoryLabel": "التصنيف الفرعي للمؤسسة الحكومية", "mainCategoryLabel": "التصنيف الرئيسي للمؤسسة الحكومية", "locationFieldLabel": "وصف الموقع", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": false, "disallowComplexUnitChild": false}	["حكومية", "حكومي"]
6519089d-a9e2-4379-a4c5-825b82526f46	تعليمية	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🏫	#3B82F6	13	other	تعليمية	تعليمية	{"descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{}	[]
0da16d20-66bd-4117-ad48-9790a3f34309	حكومية	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🏛️	#6B7280	14	other	حكومية	حكومية	{"descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{}	[]
a57dd0f1-1712-4eee-bb3a-21f5bfe14c41	مجمّع تجاري	2026-03-25 19:47:23.166377+02	2026-04-26 20:07:58.746846+03	🏬	#F59E0B	3	commercialComplex	مجمّع تجاري	المجمعات التجارية	{"attrLabels": {"complex_number": "رقم المجمع التجاري"}, "nameFieldLabel": "اسم المجمّع التجاري", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": true}	["مجمع تجاري", "commercial complex", "commercialcomplex"]
467e0014-6324-408a-a3e4-db09b7b561e5	مجمّع سكني	2026-03-25 19:47:23.166377+02	2026-04-26 20:07:58.746846+03	🏘️	#2563EB	4	residentialComplex	مجمّع سكني	المجمعات السكنية	{"attrLabels": {"complex_number": "رقم المجمع"}, "nameFieldLabel": "اسم المجمّع السكني", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": true}	["مجمع سكني", "residential complex", "residentialcomplex"]
f94792b4-6cfc-4dcb-bb83-f3c4525dd234	مقهى	2026-04-26 16:00:51.351455+03	2026-04-26 20:07:58.746846+03	☕	#2E86AB	100	other	مقهى	مقهى	{"descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{}	[]
53359cd3-c059-413e-bba0-5a4d5cc56788	متجر تجاري	2026-03-25 19:47:23.166377+02	2026-04-26 20:07:58.746846+03	🏪	#16A34A	2	store	متجر تجاري	المتاجر	{"attrLabels": {"store_type": "التصنيف الرئيسي‌ للمتجر", "store_number": "رقم هاتف المتجر", "store_category": "التصنيف الفرعي‌ للمتجر"}, "photosLabel": "صور المتجر", "nameFieldLabel": "اسم المتجر التجاري", "phoneFieldLabel": "رقم هاتف المتجر", "subCategoryLabel": "التصنيف الفرعي‌ للمتجر", "mainCategoryLabel": "التصنيف الرئيسي‌ للمتجر", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": false, "disallowComplexUnitChild": false}	["متجر"]
8ae779bc-92c0-48b7-808f-054e41ccef69	مسجد	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🕌	#10B981	6	other	مسجد	المساجد	{"attrLabels": {"location_text": "وصف الموقع"}, "photosLabel": "صور المسجد", "nameFieldLabel": "اسم المسجد", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": false}	[]
4229015c-c562-43fc-a5ad-23771f8beab9	موقف سيارات	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🅿️	#F59E0B	8	other	موقف سيارات	مواقف السيارات	{"attrLabels": {"location_text": "وصف الموقع"}, "photosLabel": "صور موقف السيارات", "nameFieldLabel": "اسم موقف السيارات", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": false}	["موقف سيارات بالأجرة", "parking", "carpark", "car park"]
00a252ed-1e24-42b7-a24f-e2b4b3096194	مؤسسة تعليمية	2026-04-26 16:20:06.42497+03	2026-04-26 20:07:58.746846+03	🏫	#3B82F6	13	store	مؤسسة تعليمية	المؤسسات التعليمية	{"photosLabel": "صور المؤسسة التعليمية", "nameFieldLabel": "اسم المؤسسة التعليمية", "phoneFieldLabel": "رقم هاتف المؤسسة التعليمية", "subCategoryLabel": "التصنيف الفرعي للمؤسسة التعليمية", "mainCategoryLabel": "التصنيف الرئيسي للمؤسسة التعليمية", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["تعليمية", "تعليمي"]
d5b09bdc-52aa-45e8-b2da-71f1bb372ce3	مكتب	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🏢	#0EA5E9	9	store	مكتب	المكاتب	{"photosLabel": "صور المكتب", "nameFieldLabel": "اسم المكتب", "phoneFieldLabel": "رقم هاتف المكتب", "subCategoryLabel": "التصنيف الفرعي للمكتب", "mainCategoryLabel": "التصنيف الرئيسي للمكتب", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["مكاتب"]
319c6711-62a6-41fd-b130-e41e6b83b42e	مستشفى	2026-04-05 16:10:47.803461+03	2026-04-26 20:07:58.746846+03	🏥	#DC2626	10	store	مستشفى	المستشفيات	{"photosLabel": "صور المستشفى", "nameFieldLabel": "اسم المستشفى", "phoneFieldLabel": "رقم هاتف المستشفى", "subCategoryLabel": "التصنيف الفرعي للمستشفى", "mainCategoryLabel": "التصنيف الرئيسي للمستشفى", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": true, "phoneAsStoreNumber": true, "productCategoryForm": true, "disallowComplexUnitChild": false}	["مستشفيات"]
d944a37e-a836-4a39-8c3d-51b3d7e4f0f2	أخرى	2026-03-25 19:47:23.166377+02	2026-04-26 20:07:58.746846+03	📍	#6B7280	15	other	أخرى	أخرى	{"attrLabels": {"location_text": "وصف الموقع"}, "nameFieldLabel": "اسم المكان", "descriptionFieldLabel": "الوصف", "mapLocationFieldLabel": "الموقع على الخريطة", "phoneFieldFallbackLabel": "رقم الهاتف"}	{"needsCategoryTree": false, "phoneAsStoreNumber": false, "productCategoryForm": false, "disallowComplexUnitChild": false}	["اخرى"]
\.


--
-- Data for Name: places; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.places (id, name, description, type_id, created_by, status, created_at, updated_at, deleted_at, owner_id, attributes, phone_number) FROM stdin;
e5fe2b0f-6e06-4f4e-b691-7cc49fb70a96	صيصيصي	يصصيصي	8f221dc7-3a25-4e5e-9ff6-6d588a79915f	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-05 17:53:38.232532+03	2026-04-06 23:21:47.678128+03	2026-04-06 23:21:47.678128+03	\N	{}	\N
617526c3-7df6-43ea-8fa6-257b13bb1e5c	فيفا سبورت	\N	53359cd3-c059-413e-bba0-5a4d5cc56788	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-03-25 21:24:11.400568+02	2026-04-06 23:21:50.920388+03	2026-04-06 23:21:50.920388+03	\N	{}	\N
c1755472-e189-4ed9-91a4-81e4430f9057	منزل المهندس ناجي	\N	86cfdde5-8748-4cc8-8dfc-c9092d7d1fff	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-03-25 20:26:04.574632+02	2026-04-06 23:21:53.238998+03	2026-04-06 23:21:53.238998+03	\N	{}	\N
b0f94e05-e511-47f9-a58c-4351d0a76f80	يص	يص	53359cd3-c059-413e-bba0-5a4d5cc56788	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-06 23:22:00.761234+03	2026-04-07 00:03:29.705524+03	2026-04-07 00:03:29.705524+03	\N	{}	\N
b1a19b7f-93d8-4f5b-9e56-ac709829cb0b	محمد بسام ابو عدة	يصص	86cfdde5-8748-4cc8-8dfc-c9092d7d1fff	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-07 18:26:14.45518+03	2026-04-07 18:26:22.276346+03	\N	\N	{"house_number": {"t": "string", "v": "0598134332"}}	\N
a22e1b5d-6d55-4d79-a7ac-25fbb4939070	xsxsx	xssx	53359cd3-c059-413e-bba0-5a4d5cc56788	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-07 00:22:21.296926+03	2026-04-19 12:25:06.598299+03	2026-04-19 12:25:06.598299+03	\N	{"store_type": {"t": "string", "v": "ملابس"}, "store_category": {"t": "string", "v": "نسائي"}}	968967
2c5d085e-07b8-48bc-9978-945770ec3e7c	fack	\N	6519089d-a9e2-4379-a4c5-825b82526f46	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-19 12:24:14.951121+03	2026-04-19 12:25:15.344216+03	2026-04-19 12:25:15.344216+03	\N	{"store_type": {"t": "string", "v": "جامعة"}, "store_category": {"t": "string", "v": "جامعة"}}	666666666666666
dc2d53c9-d9f8-415e-ad21-7df872d599fd	جامعة القدس المفتوحة	\N	6519089d-a9e2-4379-a4c5-825b82526f46	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-19 13:02:42.300309+03	2026-04-19 13:02:50.099647+03	\N	\N	{"store_type": {"t": "string", "v": "جامعة"}, "store_category": {"t": "string", "v": "جامعة"}}	0598234567
74862dc6-7775-45fa-9640-0ab7952d5474	محمد بسام ابو عدة	منيك	86cfdde5-8748-4cc8-8dfc-c9092d7d1fff	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-07 18:17:35.09252+03	2026-04-07 18:19:31.78717+03	2026-04-07 18:19:31.78717+03	\N	{"house_number": {"t": "string", "v": "059900000"}}	\N
0fed3f8b-a96e-46df-973f-51688ae0bc58	مطعم عنبتا	\N	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-11 14:15:03.241074+03	2026-04-11 14:15:11.026259+03	\N	\N	{"store_type": {"t": "string", "v": "عائلية"}, "unit_number": {"t": "text", "v": "1-1"}, "store_category": {"t": "string", "v": "برجر"}}	0598134332
02b6fe86-9a3b-49fe-8aad-74caaa0e2540	ثيث	ثبثب	467e0014-6324-408a-a3e4-db09b7b561e5	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-07 17:49:57.117775+03	2026-04-27 13:13:54.258618+03	2026-04-27 13:13:54.258618+03	\N	{"floors_count": {"t": "string", "v": "4"}, "complex_number": {"t": "string", "v": "07989"}, "units_per_floor": {"t": "string", "v": "8"}}	\N
ee209d7f-c7fe-4ce3-a375-82b96aaea845	الغضبان	مقابل دوار شويكة	a57dd0f1-1712-4eee-bb3a-21f5bfe14c41	\N	active	2026-04-19 12:57:51.521668+03	2026-04-27 13:14:01.160095+03	2026-04-27 13:14:01.160095+03	\N	{"floors_count": {"t": "string", "v": "4"}, "complex_number": {"t": "string", "v": "05912345678"}}	\N
daa70f60-bd46-4670-aee2-9854d1beefad	مجمع عسل	\N	a57dd0f1-1712-4eee-bb3a-21f5bfe14c41	4f0fb237-57de-4026-ac7f-e43fb5041d25	active	2026-04-07 18:10:18.057288+03	2026-04-27 13:14:03.686042+03	2026-04-27 13:14:03.686042+03	\N	{"floors_count": {"t": "string", "v": "4"}, "complex_number": {"t": "string", "v": "0598134332"}, "units_per_floor": {"t": "string", "v": "4"}}	\N
1b6343a2-f8e9-41ad-9851-bca98b1f164a	PIZZA HUT	\N	435d4e0c-4566-47eb-b9ba-cc510e93ffb0	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	active	2026-04-27 11:27:20.395219+03	2026-04-27 13:14:18.842799+03	2026-04-27 13:14:18.842799+03	\N	{"store_type": {"t": "string", "v": "عائلية"}, "store_category": {"t": "string", "v": "برجر"}}	0598134332
\.


--
-- Data for Name: product_main_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_main_categories (id, name, sort_order, created_at, updated_at, emoji, arrow_color) FROM stdin;
c5533fec-e80f-47a9-9b18-916037a70ea5	ملابس	0	2026-03-25 20:06:37.630216+02	2026-03-25 20:14:20.432712+02	🔥	#F59E0B
\.


--
-- Data for Name: product_sub_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_sub_categories (id, main_category_id, name, sort_order, created_at, updated_at, emoji, arrow_color) FROM stdin;
7d5134bf-7669-4259-84ae-c04ccb8ce7bc	c5533fec-e80f-47a9-9b18-916037a70ea5	رجالي	0	2026-03-25 20:14:57.62565+02	2026-03-25 20:15:03.987843+02	👨	#7C3AED
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, place_id, name, description, price, image_url, stock, is_available, sort_order, main_category, sub_category, company_name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ratings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ratings (id, place_id, user_id, rating, comment, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked_at) FROM stdin;
10ef3fdb-e5fb-4aa3-9fb7-829c06a24ac2	4f0fb237-57de-4026-ac7f-e43fb5041d25	298673c78c25c2b2508c6d560377a8d8ff60282871681939be257d037964f65f	2026-04-24 19:51:37.206+03	2026-03-25 19:51:37.207663+02	2026-03-25 20:06:37.611001+02
7a24f15e-ac1b-46b9-953f-be00571b20d1	4f0fb237-57de-4026-ac7f-e43fb5041d25	18701cd4dd9ead3a783591a1f3422541a8c1e8c4618d5f0eeca37e559a5ddb07	2026-04-24 20:06:37.617+03	2026-03-25 20:06:37.618653+02	2026-03-25 20:24:41.064959+02
c986088e-e031-465f-bf32-4903ce7c9feb	4f0fb237-57de-4026-ac7f-e43fb5041d25	ed13f7d58e64ce5d0d01fe40bc42896588b43e8a791b7093b2cc080b98a5ac5b	2026-04-24 20:24:41.074+03	2026-03-25 20:24:41.075201+02	2026-03-25 20:40:37.774437+02
795820f2-4133-4dbe-a66c-c4359b9abcdd	4f0fb237-57de-4026-ac7f-e43fb5041d25	07a485385ef4aa016490d349e3805a8f0a972919ea7e8b15795619968aa43e4c	2026-04-24 20:40:37.778+03	2026-03-25 20:40:37.780035+02	2026-03-25 20:57:24.638381+02
935f92a1-5f8c-4da4-b342-80c65e948eb1	4f0fb237-57de-4026-ac7f-e43fb5041d25	6cc9b4703816ca4925f40713ab7ebada838654304b574fe955dde4196aee82a3	2026-04-24 20:57:24.643+03	2026-03-25 20:57:24.643537+02	2026-03-25 21:24:11.378186+02
e872c8d2-52b8-415b-8c22-b87117056777	4f0fb237-57de-4026-ac7f-e43fb5041d25	cb28bb3a3d92033cae4ab7863fe10799aa1bef1dd56384eb5fabfb33db042bc9	2026-04-24 21:24:11.385+03	2026-03-25 21:24:11.386643+02	2026-03-25 21:44:20.264232+02
9b57751d-c90a-4f14-bd0d-37db10d8e0b1	4f0fb237-57de-4026-ac7f-e43fb5041d25	82d1d05d7868bce6734a7c2b0a37cf061592bde33f03dc78d8bd1375927b5de8	2026-04-24 21:44:20.266+03	2026-03-25 21:44:20.268312+02	\N
af79223f-cf9e-4ced-891c-98910ea8a345	4f0fb237-57de-4026-ac7f-e43fb5041d25	0dabecc7e4b7a92e69ac0af81490015ab37a6e36cb009490f8e70ced9ad1e4b4	2026-04-29 10:58:02.216+03	2026-03-30 10:58:02.219902+03	\N
912b0c16-7605-46d3-a957-8b6e434f8cb4	4f0fb237-57de-4026-ac7f-e43fb5041d25	c5c5f13c5806f74f3d5af58ead96419edde2fee48c3d954a985ec8eecf0b2f53	2026-05-05 11:35:53.65+03	2026-04-05 11:35:53.652137+03	2026-04-05 11:55:01.003853+03
02cfd534-99c4-4a88-9667-fed3f59b6fa4	4f0fb237-57de-4026-ac7f-e43fb5041d25	069d36c24836e5c5ad7e42778c2cb3b6ea618b925acd77e178d8f4e2308cc2e5	2026-05-05 11:57:49.618+03	2026-04-05 11:57:49.619639+03	2026-04-05 17:53:38.213635+03
d3b2fdd8-43cd-42d7-8036-ea3ca2830412	4f0fb237-57de-4026-ac7f-e43fb5041d25	82462529935db03d8824e3812d49b72da3935b876ec14934804f5dbd1b3fcafe	2026-05-05 17:53:38.217+03	2026-04-05 17:53:38.218424+03	2026-04-05 18:48:30.340386+03
4c5da17c-f082-462e-a621-3506f724cff8	4f0fb237-57de-4026-ac7f-e43fb5041d25	b7521f17bcd4290d4ed6503061e63e030d81b2dc15c5ce3a7185607db5caf3f9	2026-05-05 18:48:30.349+03	2026-04-05 18:48:30.350294+03	2026-04-05 19:32:42.913311+03
c7d718d6-2e54-4cec-94bf-426f219e8cd2	4f0fb237-57de-4026-ac7f-e43fb5041d25	000cc6bed037f4a83dcb03b2bfae5d802ce0c4cdc4dd053a5c8c789c94a093c6	2026-05-05 19:32:42.922+03	2026-04-05 19:32:42.924084+03	2026-04-06 23:21:31.371312+03
1695acb7-0255-4e3f-bd8c-ce845675068c	4f0fb237-57de-4026-ac7f-e43fb5041d25	9ced8d59ca5340bd350117014fc5de2fb6dbf68099f1b4a0afbdfc6c8c5b3fb2	2026-05-06 23:21:31.375+03	2026-04-06 23:21:31.376687+03	2026-04-06 23:39:43.385475+03
adc40c8c-3cd6-4c15-a878-357511b072a7	4f0fb237-57de-4026-ac7f-e43fb5041d25	0f1e1d578acf17a8e9619111159da5dd2916e340f5f362d227962e0ff48a64f9	2026-05-06 23:39:43.389+03	2026-04-06 23:39:43.390064+03	2026-04-06 23:54:58.67059+03
30010fe4-22b7-4cb8-b6a2-41bf29a37724	4f0fb237-57de-4026-ac7f-e43fb5041d25	0301ffba433645601eaa823af573126a568b018d271376c6a6ddbb919eb16101	2026-05-06 23:54:58.677+03	2026-04-06 23:54:58.6778+03	2026-04-07 00:11:59.414104+03
6e08a245-9da3-414b-b777-4c70e05d3f9e	4f0fb237-57de-4026-ac7f-e43fb5041d25	f8678fbc21fdfab72b1d38d1ce358c0f95f6c0e862c3d88b0aac19d6f2d1dfbb	2026-05-07 00:11:59.42+03	2026-04-07 00:11:59.421043+03	\N
e890a383-5f76-45a9-b91c-378f14205a1a	4f0fb237-57de-4026-ac7f-e43fb5041d25	6196449c5d60771a3503971157f118af7ae2fe25752deb92f085f7bae6312554	2026-05-07 00:12:08.296+03	2026-04-07 00:12:08.296605+03	\N
0a1a2da3-e9c1-4590-adbc-52ade03e6c96	4f0fb237-57de-4026-ac7f-e43fb5041d25	9f19ac77b04bfdc33d2c4d5c28bbd0f6490c28b3167fe9d7d99b0d1b4fb38a9f	2026-05-07 17:44:26.03+03	2026-04-07 17:44:26.031726+03	2026-04-07 18:02:42.727217+03
b0c97483-0971-41f1-b264-4ea50923bc66	4f0fb237-57de-4026-ac7f-e43fb5041d25	1d53b5b952ba6327c755155d5234b57acb064afa13dc0288d78885bdd5b0795f	2026-05-07 18:02:42.729+03	2026-04-07 18:02:42.730169+03	2026-04-07 18:17:54.854674+03
bdbf320c-8a58-4bcd-9854-0e8b852f95e6	4f0fb237-57de-4026-ac7f-e43fb5041d25	6f26ae563dbae33b6cf14000749a073634f908ee90b3fa46b0376873fca731b9	2026-05-07 18:17:54.86+03	2026-04-07 18:17:54.861276+03	2026-04-07 18:34:34.335878+03
2c6c382b-07f5-4e96-8501-22450902f915	4f0fb237-57de-4026-ac7f-e43fb5041d25	1adec57c046d588bf2e686bc0349203b060742c68b7c328dbe6847393a36fc71	2026-05-07 18:34:34.34+03	2026-04-07 18:34:34.341972+03	2026-04-11 13:55:23.934644+03
4605fdcb-21fc-4870-8871-42d282cc4aa6	4f0fb237-57de-4026-ac7f-e43fb5041d25	e97e2a030586cbd790b9ae681ff43bbeeff40ed7de9bc87a89f941f2cd4386df	2026-05-11 13:55:23.94+03	2026-04-11 13:55:23.941107+03	2026-04-11 14:13:10.78664+03
cdde99ae-84fa-4f77-b9c0-ab5aeeee7512	4f0fb237-57de-4026-ac7f-e43fb5041d25	c46f247f9ee9a5fb53e73545e81d5bb434698ab5dc5e0bb85138d7e2d72bb826	2026-05-11 14:13:10.791+03	2026-04-11 14:13:10.792052+03	2026-04-11 14:28:44.713153+03
1cf81918-6fef-4635-a7c3-85b080284bff	4f0fb237-57de-4026-ac7f-e43fb5041d25	f8243523f546c8007e6b22a52158a43bbd7d37ed7db43b3136c3523302301cc3	2026-05-11 14:28:44.719+03	2026-04-11 14:28:44.720366+03	2026-04-11 14:44:45.36186+03
2198577e-2441-4459-95c3-4a797518037e	4f0fb237-57de-4026-ac7f-e43fb5041d25	85b9b8e542485b75b05a5ba1441f3f8b21509bf42b85db4b5b1446c700722923	2026-05-11 14:44:45.366+03	2026-04-11 14:44:45.367381+03	\N
f430b443-cdad-4ce1-95a2-dc2a46740f90	4f0fb237-57de-4026-ac7f-e43fb5041d25	0bea83c65bdecde2f9b2a6ffdc2f5e996b8e7ff2bfe8de84202e65fa23555f1d	2026-05-13 11:04:30.013+03	2026-04-13 11:04:30.014615+03	2026-04-13 11:21:44.637221+03
96164f1c-6ea2-49fd-b475-345958095dc6	4f0fb237-57de-4026-ac7f-e43fb5041d25	b5800a33c521b5121ca7839a3c7a88b9abc32c7203aa1c4b6cf07669608509f4	2026-05-13 11:21:44.643+03	2026-04-13 11:21:44.644572+03	\N
90e4e175-f9b7-46d2-9b0d-d9eb5357f1ba	4f0fb237-57de-4026-ac7f-e43fb5041d25	696b9724f1e27cec890f2892fd308004061881016b91acfb3089a327aca23bbc	2026-05-19 12:14:14.665+03	2026-04-19 12:14:14.66769+03	2026-04-19 12:37:11.359801+03
9255c981-4132-4666-af6f-ec9672e44792	4f0fb237-57de-4026-ac7f-e43fb5041d25	0574071412d55172782aa594894ca3c608b3057af68e0e4a68d477e1bca0abf5	2026-05-19 12:22:53.091+03	2026-04-19 12:22:53.093583+03	2026-04-19 12:58:00.430664+03
ff2a89c8-ca62-4fa3-8b95-4daf8e1618fe	4f0fb237-57de-4026-ac7f-e43fb5041d25	a7731cf9b824acffb4a3a5430cd8c05e0277b89ec6978af02380a2a9096a45ae	2026-05-19 12:37:11.372+03	2026-04-19 12:37:11.373376+03	2026-04-19 13:04:23.863974+03
df44da82-b22a-4835-8de5-6cd14ab00d02	4f0fb237-57de-4026-ac7f-e43fb5041d25	116077460d3eee2495a6524fe69aa87f23d753aae8d905968d0e4eed8b64beb3	2026-05-19 12:58:00.434+03	2026-04-19 12:58:00.435667+03	2026-04-19 21:01:40.548628+03
bfcf441c-66ac-4bc9-b8e4-5c37ade4e2f1	4f0fb237-57de-4026-ac7f-e43fb5041d25	2713bb086de8a992a1fdedd12eba1a8484c4fe169b36f6a3bc7f36187b36a38f	2026-05-19 21:01:40.564+03	2026-04-19 21:01:40.566007+03	2026-04-19 21:17:16.559741+03
ab811829-fdb0-49df-8d77-8c5734a251e0	4f0fb237-57de-4026-ac7f-e43fb5041d25	8196dcffd873922fe231609927d065dd90eb3dc283cddc1d18cabd0fd0accba9	2026-05-19 21:17:16.566+03	2026-04-19 21:17:16.568023+03	2026-04-19 21:32:16.241238+03
c71f9005-a3a2-4e80-9533-1e6d41a7ce6f	4f0fb237-57de-4026-ac7f-e43fb5041d25	7df5b452c647401ea217eededb655b6548bcae0921310a8004be962a05e96dbd	2026-05-19 21:32:16.246+03	2026-04-19 21:32:16.247102+03	2026-04-19 21:47:21.446238+03
11da295e-cc35-45bb-bf5d-afdcfe9cbcc4	4f0fb237-57de-4026-ac7f-e43fb5041d25	192cad775c252053d87166b14aea658eccf5dbc8bef346f88b09dfc6f75b6e0b	2026-05-19 21:47:21.451+03	2026-04-19 21:47:21.451685+03	2026-04-19 22:05:13.909357+03
37bca612-73de-4215-b37f-b3cead29bed3	4f0fb237-57de-4026-ac7f-e43fb5041d25	b62703098baad4b44d2a4a781d3e90dee45b8d872983bb00a9dceba9c153f07b	2026-05-19 22:05:13.914+03	2026-04-19 22:05:13.914768+03	2026-04-19 22:22:04.952755+03
8668cd72-70a5-434d-8936-8d5d59afdf80	4f0fb237-57de-4026-ac7f-e43fb5041d25	17d55f15370cdcda21936cc907dc5ba1220a127017a964bb01818566c6718f54	2026-05-19 22:22:04.959+03	2026-04-19 22:22:04.959484+03	2026-04-19 22:37:08.839188+03
77b87794-6c20-49be-af8a-7c8f3e188a26	4f0fb237-57de-4026-ac7f-e43fb5041d25	679cfd4fb203ce9786c7813674c39fdcf351a6ebdaa0c1e0cfe398766e0ab65d	2026-05-19 22:37:08.844+03	2026-04-19 22:37:08.845554+03	2026-04-19 22:53:52.03219+03
a509e81b-afa2-4040-8afb-4e40dfb2f564	4f0fb237-57de-4026-ac7f-e43fb5041d25	a826d25339331075c80de307e9764c30cf24f11d2ed9afc20110443de88dd4a5	2026-05-19 22:53:52.036+03	2026-04-19 22:53:52.037918+03	\N
1276daba-e8db-49d2-b428-269043a70e05	4f0fb237-57de-4026-ac7f-e43fb5041d25	4da0026cc0c01b21463413dbfe14002c11beda0b2b0f503f7a2bb80ddc41d5d4	2026-05-26 15:31:05.339+03	2026-04-26 15:31:05.341312+03	2026-04-26 15:55:37.806147+03
18127ad0-d676-452e-b900-8caababde95d	4f0fb237-57de-4026-ac7f-e43fb5041d25	a624f1b1fe8c025713b1efa6724d57d5d5e8234318f4167f0586f8efb6098caf	2026-05-26 15:55:37.808+03	2026-04-26 15:55:37.809505+03	\N
886329d3-ca2a-4924-9134-ea169d53f83a	4f0fb237-57de-4026-ac7f-e43fb5041d25	186425965746fb0f95a67cc375c928bea5631e407a5394903fddf7a11f5e6e11	2026-05-26 15:55:52.026+03	2026-04-26 15:55:52.027255+03	2026-04-26 16:15:37.628677+03
87eac653-6775-4db3-8d41-0be8776f5dd7	4f0fb237-57de-4026-ac7f-e43fb5041d25	960b339f40e51cd28ad9ab0da0a0e8c8f2fe49f5ec8019bf313b18da3dac68f7	2026-05-26 16:15:37.633+03	2026-04-26 16:15:37.634765+03	2026-04-26 16:41:36.520077+03
41ae3a85-6916-4268-a3f6-38ed68c5bfdc	4f0fb237-57de-4026-ac7f-e43fb5041d25	69ad4a877edbc4661bfbcea841b2a5c303191869a1f15061f26f33672623a91e	2026-05-26 16:41:36.525+03	2026-04-26 16:41:36.527288+03	2026-04-26 16:42:01.202299+03
f79e5337-416c-43c7-9441-0359f00da79f	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	9e0be6f9d254c040bfde1cb3dd76b98dd8f80a3ba94fdc6d1ccfa0594cb2d38f	2026-05-26 16:42:37.565+03	2026-04-26 16:42:37.566275+03	2026-04-26 16:58:23.576049+03
8ff8f88d-8af6-49a1-b337-d9bc93eba649	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	e3a24f8e69f6bdbe885111a73fa37960ae3aae9409378bac7c15a6f6b99273c4	2026-05-26 17:01:20.022+03	2026-04-26 17:01:20.024098+03	2026-04-26 17:53:28.468738+03
9bf3048c-061e-46a6-89e0-107a7e9dd4a3	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	6168035da540cb07286d93414b9bfec2c2d4402b3df2aae18162da0696b5c0d2	2026-05-26 17:53:36.578+03	2026-04-26 17:53:36.579623+03	2026-04-26 18:13:02.121692+03
49cda9aa-7b67-444f-a63a-dd1bd6285ddb	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	10f5198fd1e3dc73d33ffccbb78a095a86f8055d5d7331ff4546a4891775ce33	2026-05-26 18:13:02.127+03	2026-04-26 18:13:02.128268+03	2026-04-26 18:25:34.49258+03
3c8ae300-37e5-4230-b410-305ced3d6015	4f0fb237-57de-4026-ac7f-e43fb5041d25	a496a4d73ddce5e7480ff3d019c9a61e0289e81073c131051c29ea60038fbaa3	2026-05-19 13:04:23.871+03	2026-04-19 13:04:23.871819+03	2026-04-27 13:14:41.51365+03
c1eaa4d5-215f-4677-ab0b-7e57587d275c	4f0fb237-57de-4026-ac7f-e43fb5041d25	8c7ced0cd9079b843f30716e9e2897456786b4fbcff0e8a592a9f048431b8f77	2026-05-26 18:25:43.91+03	2026-04-26 18:25:43.911414+03	2026-04-26 18:33:19.890333+03
ecf2956d-b9f2-4d92-bb8e-8acef2225935	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	41ddf7da71b50b17a777a9cf71cf5700d2c5ea41c5245e4bd55f15d1a621935d	2026-05-26 18:33:22.745+03	2026-04-26 18:33:22.746037+03	2026-04-26 18:43:16.134311+03
694d847e-28c3-4e7e-a777-46ee007fdf62	4f0fb237-57de-4026-ac7f-e43fb5041d25	43c23f81ec1c43d88c1108e626f8b8acc5a9bb7b3dbdaa6e42930415925abd6e	2026-05-26 18:43:22.744+03	2026-04-26 18:43:22.744844+03	2026-04-26 18:45:46.44235+03
e5676e75-702c-4f7b-95e0-cf308d1da9ee	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	14ed26d35d92ec33130be42c19821b164ba47be918ab33d83b639210fb419917	2026-05-26 18:45:49.088+03	2026-04-26 18:45:49.088999+03	2026-04-26 18:48:27.32021+03
b20ca838-8a12-4b5f-b096-dfe9b25156c9	4f0fb237-57de-4026-ac7f-e43fb5041d25	0855117c9ffc36b8952aa3d1484a6a307c9af7c6754b440349ced43fcffa4899	2026-05-26 18:48:29.798+03	2026-04-26 18:48:29.800037+03	2026-04-26 18:52:36.241503+03
3bc2a312-114d-4984-b445-39d6cf8eecca	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	d262a52b81c5d4f14235a92379961b27802caee592c82091419c0fa1192de770	2026-05-26 18:52:41.274+03	2026-04-26 18:52:41.275141+03	2026-04-26 19:44:08.173307+03
1bbeda26-ba9c-43f9-bb6f-211736d8349c	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	7fe6f8c175c2e4e0abde99dc4c176889fc3f04a16d5a13cbfb3fb05bab72b715	2026-05-26 19:44:08.183+03	2026-04-26 19:44:08.184215+03	2026-04-27 11:17:29.856719+03
33398f4e-f97c-4db9-acc5-9d386259177d	e5cd2227-5a8e-4a5a-af74-90d39611d4d9	2f46ddaca5d81a722756d7dd4abcdc56764b45e7d5f745fbf25225cbc671c3de	2026-05-27 11:17:29.889+03	2026-04-27 11:17:29.890773+03	2026-04-27 11:27:46.106967+03
dc139037-986f-4fca-8821-09dd961d72ab	4f0fb237-57de-4026-ac7f-e43fb5041d25	012b9e71b6871364d9c39f506be748e4e2998dbd7cca7ae5a30f674aa96f00e3	2026-05-27 11:27:55.592+03	2026-04-27 11:27:55.593645+03	2026-04-27 12:19:00.324839+03
87854698-2255-48e9-8040-da06204fa654	4f0fb237-57de-4026-ac7f-e43fb5041d25	eb9c3e2d0f8a6d96f135828597b99590d2892ed75a340cb767083cb348336c82	2026-05-27 12:19:00.346+03	2026-04-27 12:19:00.348046+03	2026-04-27 12:19:08.72378+03
e2c8ad9e-14ed-4629-9815-8decea1d75e0	4f0fb237-57de-4026-ac7f-e43fb5041d25	b8ad3706951d896615ea879479482b98067f93a4a944f094769c484d8ba3e460	2026-05-27 13:13:38.283+03	2026-04-27 13:13:38.284758+03	\N
63ab4930-cf42-466f-a018-739e08ae6e30	4f0fb237-57de-4026-ac7f-e43fb5041d25	da69fec81311b6f62533dce14810727441a7992d0366d18ad614324a2859c51e	2026-05-27 13:14:41.529+03	2026-04-27 13:14:41.531579+03	\N
94b7b044-c64d-4a1d-9244-9fc0fb88eb36	4f0fb237-57de-4026-ac7f-e43fb5041d25	b0261a04bab2a3d18defbdad94120762504400f887341765272edfedef4e3df8	2026-05-27 12:39:53.591+03	2026-04-27 12:39:53.592042+03	2026-04-27 15:55:16.129273+03
1abac4a7-e1a6-48e1-9209-c8689503f5db	4f0fb237-57de-4026-ac7f-e43fb5041d25	e67dc3f2e093618a9fb66035a4f2fae8d69867457a724bf07f083ff17d5761b2	2026-05-27 15:55:16.137+03	2026-04-27 15:55:16.138215+03	2026-04-27 16:12:39.281954+03
952f2138-1ef4-417c-8258-f87bbe75c030	4f0fb237-57de-4026-ac7f-e43fb5041d25	133269e9efdd7df43128e6a383e471b1a6c50219b1411194cf973a91ad34a11a	2026-05-27 16:12:39.291+03	2026-04-27 16:12:39.292266+03	2026-04-27 16:13:28.837593+03
5e7fda88-632b-4e2b-b90c-32be2c37d6c9	4f0fb237-57de-4026-ac7f-e43fb5041d25	e2956e1397987573f115d7bf819604907da5b6af24f8fc010bc6007e391cebe2	2026-05-27 16:13:31.299+03	2026-04-27 16:13:31.299811+03	2026-04-27 16:13:42.737988+03
f0ce20c5-cd89-4e06-9006-8d36a4fb6497	99d3b74a-38b0-4850-8f42-164afb2a33a6	83c66a2d5fdab86d026359874f63790386fb5e69da853c3f4ba5655a88c6252b	2026-05-27 16:13:54.458+03	2026-04-27 16:13:54.458547+03	\N
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (id, place_id, reported_by, reason, details, status, resolved_at, resolved_by, created_at) FROM stdin;
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stores (id, name, description, category_id, latitude, longitude, phone, photos, videos, created_at, owner_id) FROM stdin;
617526c3-7df6-43ea-8fa6-257b13bb1e5c	فيفا سبورت		bf8a2351-aca9-4d76-8f30-171802fd1df0	32.3102588	35.1132346	\N	[]	[]	2026-03-25 21:24:11.4+02	\N
e5fe2b0f-6e06-4f4e-b691-7cc49fb70a96	صيصيصي	يصصيصي	5e1634f8-83b9-42d6-82c6-1665c4730dac	32.3077733	35.0282710	\N	[]	[]	2026-04-05 17:53:38.232+03	\N
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tags (id, name) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, is_admin, created_at, role, updated_at, deleted_at, phone_number, date_of_birth, profile_image_url, id_card_image_url, verification_status) FROM stdin;
4f0fb237-57de-4026-ac7f-e43fb5041d25	مدير التطبيق	admin@tulkarm.com	$2a$10$LhEcnayK86fT3Lz8q8jKO.HOIorY51vrOg7RvrPmU7iJES1VITC1K	t	2026-03-25 19:47:22.792238+02	admin	2026-03-25 19:47:22.795806+02	\N	\N	\N	\N	\N	unverified
e5cd2227-5a8e-4a5a-af74-90d39611d4d9	NAIJ SABHA	naji@tulkarm.com	$2a$12$gmvrFzZJpKnaw8n/t3kx/eUnb1LKkbw8s4zYuq.0JCQj3zq29SNYS	f	2026-04-26 16:42:37.563033+03	user	2026-04-27 11:29:17.172813+03	\N	0598134332	2005-04-15	https://res.cloudinary.com/dgo6ile38/image/upload/v1777216484/tulkarm-map/iayfxtjmhqwc7mrtveju.jpg	https://res.cloudinary.com/dgo6ile38/image/upload/v1777216535/tulkarm-map/mjlcrfloe3nkihddp5ga.jpg	verified
99d3b74a-38b0-4850-8f42-164afb2a33a6	System Admin	admin@system.local	$2a$10$bB3NHV/VFX3e10sxhXvZ4.GbGhPUMZnAD6Wtuv9wNyDE5wRgZEEtq	t	2026-04-27 16:09:09.570245+03	admin	2026-04-27 16:09:09.570245+03	\N	\N	\N	\N	\N	unverified
\.


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: complex_units complex_unit_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complex_units
    ADD CONSTRAINT complex_unit_unique UNIQUE (complex_id, floor_number, unit_number);


--
-- Name: complex_units complex_units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complex_units
    ADD CONSTRAINT complex_units_pkey PRIMARY KEY (id);


--
-- Name: complexes complexes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complexes
    ADD CONSTRAINT complexes_pkey PRIMARY KEY (id);


--
-- Name: complexes complexes_place_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complexes
    ADD CONSTRAINT complexes_place_unique UNIQUE (place_id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, place_id);


--
-- Name: house_details house_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.house_details
    ADD CONSTRAINT house_details_pkey PRIMARY KEY (place_id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: place_attributes place_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_attributes
    ADD CONSTRAINT place_attributes_pkey PRIMARY KEY (id);


--
-- Name: place_attributes place_attributes_place_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_attributes
    ADD CONSTRAINT place_attributes_place_key_unique UNIQUE (place_id, key);


--
-- Name: place_categories place_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_categories
    ADD CONSTRAINT place_categories_pkey PRIMARY KEY (id);


--
-- Name: place_categories place_categories_unique_type_parent_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_categories
    ADD CONSTRAINT place_categories_unique_type_parent_name UNIQUE (place_type_id, parent_id, name);


--
-- Name: place_category_links place_category_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_category_links
    ADD CONSTRAINT place_category_links_pkey PRIMARY KEY (place_id);


--
-- Name: place_locations place_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_locations
    ADD CONSTRAINT place_locations_pkey PRIMARY KEY (place_id);


--
-- Name: place_requests place_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_requests
    ADD CONSTRAINT place_requests_pkey PRIMARY KEY (id);


--
-- Name: place_tags place_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_tags
    ADD CONSTRAINT place_tags_pkey PRIMARY KEY (place_id, tag_id);


--
-- Name: place_type_attribute_definitions place_type_attribute_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_type_attribute_definitions
    ADD CONSTRAINT place_type_attribute_definitions_pkey PRIMARY KEY (id);


--
-- Name: place_types place_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_types
    ADD CONSTRAINT place_types_name_key UNIQUE (name);


--
-- Name: place_types place_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_types
    ADD CONSTRAINT place_types_pkey PRIMARY KEY (id);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: product_main_categories product_main_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_main_categories
    ADD CONSTRAINT product_main_categories_name_key UNIQUE (name);


--
-- Name: product_main_categories product_main_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_main_categories
    ADD CONSTRAINT product_main_categories_pkey PRIMARY KEY (id);


--
-- Name: product_sub_categories product_sub_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sub_categories
    ADD CONSTRAINT product_sub_categories_pkey PRIMARY KEY (id);


--
-- Name: product_sub_categories product_sub_categories_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sub_categories
    ADD CONSTRAINT product_sub_categories_unique UNIQUE (main_category_id, name);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: place_type_attribute_definitions ptad_type_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_type_attribute_definitions
    ADD CONSTRAINT ptad_type_key_unique UNIQUE (place_type_id, key);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_place_user_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_place_user_unique UNIQUE (place_id, user_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_complex_units_child; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_complex_units_child ON public.complex_units USING btree (child_place_id) WHERE (child_place_id IS NOT NULL);


--
-- Name: idx_complex_units_complex; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_complex_units_complex ON public.complex_units USING btree (complex_id);


--
-- Name: idx_complexes_place; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_complexes_place ON public.complexes USING btree (place_id);


--
-- Name: idx_media_place; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_media_place ON public.media USING btree (place_id, sort_order);


--
-- Name: idx_place_attributes_place_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_attributes_place_key ON public.place_attributes USING btree (place_id, key);


--
-- Name: idx_place_categories_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_categories_parent ON public.place_categories USING btree (parent_id, sort_order);


--
-- Name: idx_place_categories_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_categories_type ON public.place_categories USING btree (place_type_id, sort_order);


--
-- Name: idx_place_category_links_main; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_category_links_main ON public.place_category_links USING btree (main_category_id);


--
-- Name: idx_place_category_links_sub; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_category_links_sub ON public.place_category_links USING btree (sub_category_id);


--
-- Name: idx_place_locations_coords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_locations_coords ON public.place_locations USING btree (latitude, longitude);


--
-- Name: idx_place_types_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_place_types_name ON public.place_types USING btree (name);


--
-- Name: idx_places_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_places_owner ON public.places USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: idx_places_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_places_status ON public.places USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_places_type_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_places_type_created ON public.places USING btree (type_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_main_categories_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_main_categories_sort ON public.product_main_categories USING btree (sort_order, name);


--
-- Name: idx_product_sub_categories_main_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sub_categories_main_sort ON public.product_sub_categories USING btree (main_category_id, sort_order, name);


--
-- Name: idx_product_sub_main; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_sub_main ON public.product_sub_categories USING btree (main_category_id, sort_order);


--
-- Name: idx_products_place; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_place ON public.products USING btree (place_id) WHERE (is_available = true);


--
-- Name: idx_ratings_place; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ratings_place ON public.ratings USING btree (place_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_ratings_place_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ratings_place_created ON public.ratings USING btree (place_id, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_refresh_tokens_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash) WHERE (revoked_at IS NULL);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_stores_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stores_location ON public.stores USING btree (latitude, longitude);


--
-- Name: idx_stores_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stores_owner ON public.stores USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: complex_units complex_units_child_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complex_units
    ADD CONSTRAINT complex_units_child_place_id_fkey FOREIGN KEY (child_place_id) REFERENCES public.places(id) ON DELETE SET NULL;


--
-- Name: complex_units complex_units_complex_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complex_units
    ADD CONSTRAINT complex_units_complex_id_fkey FOREIGN KEY (complex_id) REFERENCES public.complexes(id) ON DELETE CASCADE;


--
-- Name: complexes complexes_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.complexes
    ADD CONSTRAINT complexes_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: house_details house_details_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.house_details
    ADD CONSTRAINT house_details_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: media media_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: place_attributes place_attributes_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_attributes
    ADD CONSTRAINT place_attributes_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: place_categories place_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_categories
    ADD CONSTRAINT place_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.place_categories(id) ON DELETE CASCADE;


--
-- Name: place_categories place_categories_place_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_categories
    ADD CONSTRAINT place_categories_place_type_id_fkey FOREIGN KEY (place_type_id) REFERENCES public.place_types(id) ON DELETE CASCADE;


--
-- Name: place_category_links place_category_links_main_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_category_links
    ADD CONSTRAINT place_category_links_main_category_id_fkey FOREIGN KEY (main_category_id) REFERENCES public.place_categories(id) ON DELETE SET NULL;


--
-- Name: place_category_links place_category_links_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_category_links
    ADD CONSTRAINT place_category_links_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: place_category_links place_category_links_sub_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_category_links
    ADD CONSTRAINT place_category_links_sub_category_id_fkey FOREIGN KEY (sub_category_id) REFERENCES public.place_categories(id) ON DELETE SET NULL;


--
-- Name: place_locations place_locations_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_locations
    ADD CONSTRAINT place_locations_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: place_requests place_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_requests
    ADD CONSTRAINT place_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: place_requests place_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_requests
    ADD CONSTRAINT place_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: place_tags place_tags_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_tags
    ADD CONSTRAINT place_tags_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: place_tags place_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_tags
    ADD CONSTRAINT place_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: place_type_attribute_definitions place_type_attribute_definitions_place_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.place_type_attribute_definitions
    ADD CONSTRAINT place_type_attribute_definitions_place_type_id_fkey FOREIGN KEY (place_type_id) REFERENCES public.place_types(id) ON DELETE CASCADE;


--
-- Name: places places_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: places places_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: places places_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.place_types(id) ON DELETE SET NULL;


--
-- Name: product_sub_categories product_sub_categories_main_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_sub_categories
    ADD CONSTRAINT product_sub_categories_main_category_id_fkey FOREIGN KEY (main_category_id) REFERENCES public.product_main_categories(id) ON DELETE RESTRICT;


--
-- Name: products products_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: ratings ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reports reports_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_store_id_fkey FOREIGN KEY (place_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stores stores_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict fBRbz217KWfXkecheEp9S9Xy4n5CH9fiOgYmzr0eDrwcw4p4AgZgrQJgavVGV9P

