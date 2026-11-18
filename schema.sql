--
-- PostgreSQL database dump
--

\restrict GNOObTmzMaOmHZr7HAbbdd5NglGpQaTfWKAB53dMKSsfc0vcgXgFdLNY4RNppZj

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: EvaluationCriteria; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."EvaluationCriteria" (
    "Id" uuid NOT NULL,
    "TemplateId" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "MaxScore" numeric(5,2) NOT NULL,
    "SortOrder" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "Description" character varying(1000)
);


ALTER TABLE public."EvaluationCriteria" OWNER TO se310;

--
-- Name: EvaluationSubCriteria; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."EvaluationSubCriteria" (
    "Id" uuid NOT NULL,
    "CriterionId" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "MaxScore" numeric(5,2) NOT NULL,
    "SortOrder" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."EvaluationSubCriteria" OWNER TO se310;

--
-- Name: EvaluationTemplateAssignments; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."EvaluationTemplateAssignments" (
    "Id" uuid NOT NULL,
    "RoundId" character varying(64) NOT NULL,
    "Role" character varying(16) NOT NULL,
    "TemplateId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."EvaluationTemplateAssignments" OWNER TO se310;

--
-- Name: EvaluationTemplates; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."EvaluationTemplates" (
    "Id" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "NormalizedName" character varying(200) NOT NULL,
    "Description" character varying(1000),
    "MaxScore" numeric(5,2) NOT NULL,
    "Status" character varying(16) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."EvaluationTemplates" OWNER TO se310;

--
-- Name: GroupMembers; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."GroupMembers" (
    "Id" uuid NOT NULL,
    "GroupId" uuid NOT NULL,
    "RoundId" uuid NOT NULL,
    "StudentId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."GroupMembers" OWNER TO se310;

--
-- Name: Notifications; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."Notifications" (
    "Id" uuid NOT NULL,
    "BatchId" uuid NOT NULL,
    "RecipientUserId" uuid NOT NULL,
    "SenderUserId" uuid,
    "Kind" character varying(16) NOT NULL,
    "Text" character varying(2000) NOT NULL,
    "Href" character varying(512) NOT NULL,
    "ReadAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."Notifications" OWNER TO se310;

--
-- Name: PasswordResetRequests; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."PasswordResetRequests" (
    "Id" uuid NOT NULL,
    "EmailHash" character varying(64) NOT NULL,
    "Source" character varying(64) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."PasswordResetRequests" OWNER TO se310;

--
-- Name: PasswordResetTokens; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."PasswordResetTokens" (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "TokenHash" character varying(64) NOT NULL,
    "SecurityStamp" character varying(64) NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "UsedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."PasswordResetTokens" OWNER TO se310;

--
-- Name: Products; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."Products" (
    "Id" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "Description" text NOT NULL,
    "Price" numeric(18,2) NOT NULL,
    "Stock" integer NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."Products" OWNER TO se310;

--
-- Name: RevisionRequestLinks; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."RevisionRequestLinks" (
    "SubmissionId" uuid NOT NULL,
    "RequestId" uuid NOT NULL
);


ALTER TABLE public."RevisionRequestLinks" OWNER TO se310;

--
-- Name: RevisionRequests; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."RevisionRequests" (
    "Id" uuid NOT NULL,
    "TopicId" uuid NOT NULL,
    "Content" character varying(2000) NOT NULL,
    "CreatedById" uuid NOT NULL,
    "RaisedOnSubmissionId" uuid NOT NULL,
    "ResolvedById" uuid,
    "ResolvedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "Kind" character varying(16) DEFAULT 'Outline'::character varying NOT NULL
);


ALTER TABLE public."RevisionRequests" OWNER TO se310;

--
-- Name: RoundMilestones; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."RoundMilestones" (
    "Id" uuid NOT NULL,
    "RoundId" uuid NOT NULL,
    "Key" character varying(32) NOT NULL,
    "StartDate" date,
    "EndDate" date,
    "NotifyAudience" character varying(16) NOT NULL,
    "AllowLate" boolean,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "LateEndDate" date
);


ALTER TABLE public."RoundMilestones" OWNER TO se310;

--
-- Name: RoundParticipants; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."RoundParticipants" (
    "Id" uuid NOT NULL,
    "RoundId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "Kind" character varying(16) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."RoundParticipants" OWNER TO se310;

--
-- Name: ThesisGroups; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."ThesisGroups" (
    "Id" uuid NOT NULL,
    "RoundId" uuid NOT NULL,
    "RepresentativeId" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."ThesisGroups" OWNER TO se310;

--
-- Name: ThesisRounds; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."ThesisRounds" (
    "Id" uuid NOT NULL,
    "Name" character varying(200) NOT NULL,
    "NormalizedName" character varying(200) NOT NULL,
    "Program" character varying(32) NOT NULL,
    "PeriodLabel" character varying(200) NOT NULL,
    "Status" character varying(16) NOT NULL,
    "CopiedFromId" uuid,
    "OpenedAt" timestamp with time zone,
    "FinishedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "LecturerLoadMax" integer DEFAULT 0 NOT NULL,
    "LecturerLoadMin" integer DEFAULT 0 NOT NULL,
    "TopicsPublishedAt" timestamp with time zone
);


ALTER TABLE public."ThesisRounds" OWNER TO se310;

--
-- Name: ThesisTopics; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."ThesisTopics" (
    "Id" uuid NOT NULL,
    "RoundId" uuid NOT NULL,
    "Number" integer NOT NULL,
    "Title" character varying(300) NOT NULL,
    "Description" character varying(4000) NOT NULL,
    "Requirements" character varying(2000),
    "Field" character varying(100) NOT NULL,
    "SupervisorId" uuid NOT NULL,
    "Source" character varying(32) NOT NULL,
    "Status" character varying(32) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "GroupId" uuid,
    "OutlineApprovedAt" timestamp with time zone,
    "OutlineApprovedById" uuid,
    "OutlineApprovedSubmissionId" uuid,
    "FinalThesisLockedAt" timestamp with time zone,
    "FinalThesisLockedById" uuid,
    "FinalThesisSubmissionId" uuid,
    "IneligibleAt" timestamp with time zone,
    "IneligibleById" uuid,
    "IneligibleReason" character varying(800),
    "ThesisExtensionEnd" date,
    "ThesisExtensionGrantedAt" timestamp with time zone,
    "ThesisExtensionGrantedById" uuid,
    "ThesisExtensionReason" character varying(800)
);


ALTER TABLE public."ThesisTopics" OWNER TO se310;

--
-- Name: TopicHistoryEntries; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."TopicHistoryEntries" (
    "Id" uuid NOT NULL,
    "TopicId" uuid NOT NULL,
    "ActorUserId" uuid,
    "Category" character varying(32) NOT NULL,
    "Action" character varying(100) NOT NULL,
    "Detail" character varying(8000),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."TopicHistoryEntries" OWNER TO se310;

--
-- Name: TopicRegistrations; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."TopicRegistrations" (
    "Id" uuid NOT NULL,
    "TopicId" uuid NOT NULL,
    "GroupId" uuid NOT NULL,
    "RegisteredById" uuid NOT NULL,
    "CancelledById" uuid,
    "CancelledAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."TopicRegistrations" OWNER TO se310;

--
-- Name: TopicSubmissions; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."TopicSubmissions" (
    "Id" uuid NOT NULL,
    "TopicId" uuid NOT NULL,
    "Kind" character varying(16) NOT NULL,
    "VersionNo" integer NOT NULL,
    "ObjectKey" character varying(200) NOT NULL,
    "FileName" character varying(200) NOT NULL,
    "SizeBytes" bigint NOT NULL,
    "Note" character varying(2000),
    "SubmittedById" uuid NOT NULL,
    "Late" boolean NOT NULL,
    "ReviewComment" character varying(2000),
    "ReviewedById" uuid,
    "ReviewedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."TopicSubmissions" OWNER TO se310;

--
-- Name: UserAuditEntries; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."UserAuditEntries" (
    "Id" uuid NOT NULL,
    "TargetUserId" uuid NOT NULL,
    "TargetUserCode" character varying(50) NOT NULL,
    "ActorUserId" uuid NOT NULL,
    "Action" character varying(32) NOT NULL,
    "Details" jsonb,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone
);


ALTER TABLE public."UserAuditEntries" OWNER TO se310;

--
-- Name: Users; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."Users" (
    "Id" uuid NOT NULL,
    "UserCode" character varying(50) NOT NULL,
    "FullName" character varying(200) NOT NULL,
    "Email" character varying(256) NOT NULL,
    "PasswordHash" character varying(100) NOT NULL,
    "Role" character varying(32) NOT NULL,
    "IsActive" boolean NOT NULL,
    "MustChangePassword" boolean NOT NULL,
    "SecurityStamp" character varying(64) NOT NULL,
    "LastLoginAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone,
    "ActivationCodeExpiresAt" timestamp with time zone,
    "ActivationCodeFailedAttempts" integer DEFAULT 0 NOT NULL,
    "ActivationCodeHash" character varying(100),
    "ActivationCodeSentAt" timestamp with time zone,
    "AcademicTitle" character varying(100),
    "ClassName" character varying(100),
    "DateOfBirth" date,
    "Department" character varying(100),
    "AvatarObjectKey" character varying(512),
    "Phone" character varying(32),
    "SecondaryEmail" character varying(256)
);


ALTER TABLE public."Users" OWNER TO se310;

--
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: se310
--

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


ALTER TABLE public."__EFMigrationsHistory" OWNER TO se310;

--
-- Name: EvaluationCriteria PK_EvaluationCriteria; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationCriteria"
    ADD CONSTRAINT "PK_EvaluationCriteria" PRIMARY KEY ("Id");


--
-- Name: EvaluationSubCriteria PK_EvaluationSubCriteria; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationSubCriteria"
    ADD CONSTRAINT "PK_EvaluationSubCriteria" PRIMARY KEY ("Id");


--
-- Name: EvaluationTemplateAssignments PK_EvaluationTemplateAssignments; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationTemplateAssignments"
    ADD CONSTRAINT "PK_EvaluationTemplateAssignments" PRIMARY KEY ("Id");


--
-- Name: EvaluationTemplates PK_EvaluationTemplates; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationTemplates"
    ADD CONSTRAINT "PK_EvaluationTemplates" PRIMARY KEY ("Id");


--
-- Name: GroupMembers PK_GroupMembers; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."GroupMembers"
    ADD CONSTRAINT "PK_GroupMembers" PRIMARY KEY ("Id");


--
-- Name: Notifications PK_Notifications; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."Notifications"
    ADD CONSTRAINT "PK_Notifications" PRIMARY KEY ("Id");


--
-- Name: PasswordResetRequests PK_PasswordResetRequests; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."PasswordResetRequests"
    ADD CONSTRAINT "PK_PasswordResetRequests" PRIMARY KEY ("Id");


--
-- Name: PasswordResetTokens PK_PasswordResetTokens; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."PasswordResetTokens"
    ADD CONSTRAINT "PK_PasswordResetTokens" PRIMARY KEY ("Id");


--
-- Name: Products PK_Products; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."Products"
    ADD CONSTRAINT "PK_Products" PRIMARY KEY ("Id");


--
-- Name: RevisionRequestLinks PK_RevisionRequestLinks; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequestLinks"
    ADD CONSTRAINT "PK_RevisionRequestLinks" PRIMARY KEY ("SubmissionId", "RequestId");


--
-- Name: RevisionRequests PK_RevisionRequests; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequests"
    ADD CONSTRAINT "PK_RevisionRequests" PRIMARY KEY ("Id");


--
-- Name: RoundMilestones PK_RoundMilestones; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RoundMilestones"
    ADD CONSTRAINT "PK_RoundMilestones" PRIMARY KEY ("Id");


--
-- Name: RoundParticipants PK_RoundParticipants; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RoundParticipants"
    ADD CONSTRAINT "PK_RoundParticipants" PRIMARY KEY ("Id");


--
-- Name: ThesisGroups PK_ThesisGroups; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisGroups"
    ADD CONSTRAINT "PK_ThesisGroups" PRIMARY KEY ("Id");


--
-- Name: ThesisRounds PK_ThesisRounds; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisRounds"
    ADD CONSTRAINT "PK_ThesisRounds" PRIMARY KEY ("Id");


--
-- Name: ThesisTopics PK_ThesisTopics; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisTopics"
    ADD CONSTRAINT "PK_ThesisTopics" PRIMARY KEY ("Id");


--
-- Name: TopicHistoryEntries PK_TopicHistoryEntries; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicHistoryEntries"
    ADD CONSTRAINT "PK_TopicHistoryEntries" PRIMARY KEY ("Id");


--
-- Name: TopicRegistrations PK_TopicRegistrations; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicRegistrations"
    ADD CONSTRAINT "PK_TopicRegistrations" PRIMARY KEY ("Id");


--
-- Name: TopicSubmissions PK_TopicSubmissions; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicSubmissions"
    ADD CONSTRAINT "PK_TopicSubmissions" PRIMARY KEY ("Id");


--
-- Name: UserAuditEntries PK_UserAuditEntries; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."UserAuditEntries"
    ADD CONSTRAINT "PK_UserAuditEntries" PRIMARY KEY ("Id");


--
-- Name: Users PK_Users; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."Users"
    ADD CONSTRAINT "PK_Users" PRIMARY KEY ("Id");


--
-- Name: __EFMigrationsHistory PK___EFMigrationsHistory; Type: CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


--
-- Name: IX_EvaluationCriteria_TemplateId_SortOrder; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_EvaluationCriteria_TemplateId_SortOrder" ON public."EvaluationCriteria" USING btree ("TemplateId", "SortOrder");


--
-- Name: IX_EvaluationSubCriteria_CriterionId_SortOrder; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_EvaluationSubCriteria_CriterionId_SortOrder" ON public."EvaluationSubCriteria" USING btree ("CriterionId", "SortOrder");


--
-- Name: IX_EvaluationTemplateAssignments_RoundId_Role; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_EvaluationTemplateAssignments_RoundId_Role" ON public."EvaluationTemplateAssignments" USING btree ("RoundId", "Role");


--
-- Name: IX_EvaluationTemplateAssignments_TemplateId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_EvaluationTemplateAssignments_TemplateId" ON public."EvaluationTemplateAssignments" USING btree ("TemplateId");


--
-- Name: IX_EvaluationTemplates_NormalizedName; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_EvaluationTemplates_NormalizedName" ON public."EvaluationTemplates" USING btree ("NormalizedName");


--
-- Name: IX_GroupMembers_GroupId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_GroupMembers_GroupId" ON public."GroupMembers" USING btree ("GroupId");


--
-- Name: IX_GroupMembers_RoundId_StudentId; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_GroupMembers_RoundId_StudentId" ON public."GroupMembers" USING btree ("RoundId", "StudentId");


--
-- Name: IX_GroupMembers_StudentId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_GroupMembers_StudentId" ON public."GroupMembers" USING btree ("StudentId");


--
-- Name: IX_Notifications_BatchId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_Notifications_BatchId" ON public."Notifications" USING btree ("BatchId");


--
-- Name: IX_Notifications_RecipientUserId_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_Notifications_RecipientUserId_CreatedAt" ON public."Notifications" USING btree ("RecipientUserId", "CreatedAt");


--
-- Name: IX_Notifications_SenderUserId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_Notifications_SenderUserId" ON public."Notifications" USING btree ("SenderUserId");


--
-- Name: IX_PasswordResetRequests_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_PasswordResetRequests_CreatedAt" ON public."PasswordResetRequests" USING btree ("CreatedAt");


--
-- Name: IX_PasswordResetRequests_EmailHash_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_PasswordResetRequests_EmailHash_CreatedAt" ON public."PasswordResetRequests" USING btree ("EmailHash", "CreatedAt");


--
-- Name: IX_PasswordResetRequests_Source_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_PasswordResetRequests_Source_CreatedAt" ON public."PasswordResetRequests" USING btree ("Source", "CreatedAt");


--
-- Name: IX_PasswordResetTokens_TokenHash; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_PasswordResetTokens_TokenHash" ON public."PasswordResetTokens" USING btree ("TokenHash");


--
-- Name: IX_PasswordResetTokens_UserId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_PasswordResetTokens_UserId" ON public."PasswordResetTokens" USING btree ("UserId");


--
-- Name: IX_RevisionRequestLinks_RequestId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RevisionRequestLinks_RequestId" ON public."RevisionRequestLinks" USING btree ("RequestId");


--
-- Name: IX_RevisionRequests_CreatedById; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RevisionRequests_CreatedById" ON public."RevisionRequests" USING btree ("CreatedById");


--
-- Name: IX_RevisionRequests_RaisedOnSubmissionId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RevisionRequests_RaisedOnSubmissionId" ON public."RevisionRequests" USING btree ("RaisedOnSubmissionId");


--
-- Name: IX_RevisionRequests_TopicId_Kind_ResolvedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RevisionRequests_TopicId_Kind_ResolvedAt" ON public."RevisionRequests" USING btree ("TopicId", "Kind", "ResolvedAt");


--
-- Name: IX_RevisionRequests_TopicId_ResolvedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RevisionRequests_TopicId_ResolvedAt" ON public."RevisionRequests" USING btree ("TopicId", "ResolvedAt");


--
-- Name: IX_RoundMilestones_RoundId_Key; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_RoundMilestones_RoundId_Key" ON public."RoundMilestones" USING btree ("RoundId", "Key");


--
-- Name: IX_RoundParticipants_RoundId_UserId; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_RoundParticipants_RoundId_UserId" ON public."RoundParticipants" USING btree ("RoundId", "UserId");


--
-- Name: IX_RoundParticipants_UserId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_RoundParticipants_UserId" ON public."RoundParticipants" USING btree ("UserId");


--
-- Name: IX_ThesisGroups_RepresentativeId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_ThesisGroups_RepresentativeId" ON public."ThesisGroups" USING btree ("RepresentativeId");


--
-- Name: IX_ThesisGroups_RoundId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_ThesisGroups_RoundId" ON public."ThesisGroups" USING btree ("RoundId");


--
-- Name: IX_ThesisRounds_CopiedFromId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_ThesisRounds_CopiedFromId" ON public."ThesisRounds" USING btree ("CopiedFromId");


--
-- Name: IX_ThesisRounds_NormalizedName; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_ThesisRounds_NormalizedName" ON public."ThesisRounds" USING btree ("NormalizedName");


--
-- Name: IX_ThesisRounds_Status; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_ThesisRounds_Status" ON public."ThesisRounds" USING btree ("Status");


--
-- Name: IX_ThesisTopics_ActiveGroupId; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_ThesisTopics_ActiveGroupId" ON public."ThesisTopics" USING btree ("GroupId") WHERE (("GroupId" IS NOT NULL) AND (("Status")::text = ANY ((ARRAY['PendingApproval'::character varying, 'Registered'::character varying, 'Rejected'::character varying])::text[])));


--
-- Name: IX_ThesisTopics_RoundId_Number; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_ThesisTopics_RoundId_Number" ON public."ThesisTopics" USING btree ("RoundId", "Number");


--
-- Name: IX_ThesisTopics_SupervisorId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_ThesisTopics_SupervisorId" ON public."ThesisTopics" USING btree ("SupervisorId");


--
-- Name: IX_TopicHistoryEntries_TopicId_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_TopicHistoryEntries_TopicId_CreatedAt" ON public."TopicHistoryEntries" USING btree ("TopicId", "CreatedAt");


--
-- Name: IX_TopicRegistrations_GroupId_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_TopicRegistrations_GroupId_CreatedAt" ON public."TopicRegistrations" USING btree ("GroupId", "CreatedAt");


--
-- Name: IX_TopicRegistrations_TopicId; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_TopicRegistrations_TopicId" ON public."TopicRegistrations" USING btree ("TopicId");


--
-- Name: IX_TopicSubmissions_SubmittedById; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_TopicSubmissions_SubmittedById" ON public."TopicSubmissions" USING btree ("SubmittedById");


--
-- Name: IX_TopicSubmissions_TopicId_Kind_VersionNo; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_TopicSubmissions_TopicId_Kind_VersionNo" ON public."TopicSubmissions" USING btree ("TopicId", "Kind", "VersionNo");


--
-- Name: IX_UserAuditEntries_TargetUserId_CreatedAt; Type: INDEX; Schema: public; Owner: se310
--

CREATE INDEX "IX_UserAuditEntries_TargetUserId_CreatedAt" ON public."UserAuditEntries" USING btree ("TargetUserId", "CreatedAt");


--
-- Name: IX_Users_Email; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_Users_Email" ON public."Users" USING btree ("Email");


--
-- Name: IX_Users_UserCode; Type: INDEX; Schema: public; Owner: se310
--

CREATE UNIQUE INDEX "IX_Users_UserCode" ON public."Users" USING btree ("UserCode");


--
-- Name: EvaluationCriteria FK_EvaluationCriteria_EvaluationTemplates_TemplateId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationCriteria"
    ADD CONSTRAINT "FK_EvaluationCriteria_EvaluationTemplates_TemplateId" FOREIGN KEY ("TemplateId") REFERENCES public."EvaluationTemplates"("Id") ON DELETE CASCADE;


--
-- Name: EvaluationSubCriteria FK_EvaluationSubCriteria_EvaluationCriteria_CriterionId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationSubCriteria"
    ADD CONSTRAINT "FK_EvaluationSubCriteria_EvaluationCriteria_CriterionId" FOREIGN KEY ("CriterionId") REFERENCES public."EvaluationCriteria"("Id") ON DELETE CASCADE;


--
-- Name: EvaluationTemplateAssignments FK_EvaluationTemplateAssignments_EvaluationTemplates_TemplateId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."EvaluationTemplateAssignments"
    ADD CONSTRAINT "FK_EvaluationTemplateAssignments_EvaluationTemplates_TemplateId" FOREIGN KEY ("TemplateId") REFERENCES public."EvaluationTemplates"("Id") ON DELETE RESTRICT;


--
-- Name: GroupMembers FK_GroupMembers_ThesisGroups_GroupId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."GroupMembers"
    ADD CONSTRAINT "FK_GroupMembers_ThesisGroups_GroupId" FOREIGN KEY ("GroupId") REFERENCES public."ThesisGroups"("Id") ON DELETE CASCADE;


--
-- Name: GroupMembers FK_GroupMembers_ThesisRounds_RoundId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."GroupMembers"
    ADD CONSTRAINT "FK_GroupMembers_ThesisRounds_RoundId" FOREIGN KEY ("RoundId") REFERENCES public."ThesisRounds"("Id") ON DELETE CASCADE;


--
-- Name: GroupMembers FK_GroupMembers_Users_StudentId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."GroupMembers"
    ADD CONSTRAINT "FK_GroupMembers_Users_StudentId" FOREIGN KEY ("StudentId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: Notifications FK_Notifications_Users_RecipientUserId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."Notifications"
    ADD CONSTRAINT "FK_Notifications_Users_RecipientUserId" FOREIGN KEY ("RecipientUserId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: Notifications FK_Notifications_Users_SenderUserId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."Notifications"
    ADD CONSTRAINT "FK_Notifications_Users_SenderUserId" FOREIGN KEY ("SenderUserId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: PasswordResetTokens FK_PasswordResetTokens_Users_UserId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."PasswordResetTokens"
    ADD CONSTRAINT "FK_PasswordResetTokens_Users_UserId" FOREIGN KEY ("UserId") REFERENCES public."Users"("Id") ON DELETE CASCADE;


--
-- Name: RevisionRequestLinks FK_RevisionRequestLinks_RevisionRequests_RequestId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequestLinks"
    ADD CONSTRAINT "FK_RevisionRequestLinks_RevisionRequests_RequestId" FOREIGN KEY ("RequestId") REFERENCES public."RevisionRequests"("Id") ON DELETE CASCADE;


--
-- Name: RevisionRequestLinks FK_RevisionRequestLinks_TopicSubmissions_SubmissionId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequestLinks"
    ADD CONSTRAINT "FK_RevisionRequestLinks_TopicSubmissions_SubmissionId" FOREIGN KEY ("SubmissionId") REFERENCES public."TopicSubmissions"("Id") ON DELETE CASCADE;


--
-- Name: RevisionRequests FK_RevisionRequests_ThesisTopics_TopicId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequests"
    ADD CONSTRAINT "FK_RevisionRequests_ThesisTopics_TopicId" FOREIGN KEY ("TopicId") REFERENCES public."ThesisTopics"("Id") ON DELETE CASCADE;


--
-- Name: RevisionRequests FK_RevisionRequests_TopicSubmissions_RaisedOnSubmissionId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequests"
    ADD CONSTRAINT "FK_RevisionRequests_TopicSubmissions_RaisedOnSubmissionId" FOREIGN KEY ("RaisedOnSubmissionId") REFERENCES public."TopicSubmissions"("Id");


--
-- Name: RevisionRequests FK_RevisionRequests_Users_CreatedById; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RevisionRequests"
    ADD CONSTRAINT "FK_RevisionRequests_Users_CreatedById" FOREIGN KEY ("CreatedById") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: RoundMilestones FK_RoundMilestones_ThesisRounds_RoundId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RoundMilestones"
    ADD CONSTRAINT "FK_RoundMilestones_ThesisRounds_RoundId" FOREIGN KEY ("RoundId") REFERENCES public."ThesisRounds"("Id") ON DELETE CASCADE;


--
-- Name: RoundParticipants FK_RoundParticipants_ThesisRounds_RoundId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RoundParticipants"
    ADD CONSTRAINT "FK_RoundParticipants_ThesisRounds_RoundId" FOREIGN KEY ("RoundId") REFERENCES public."ThesisRounds"("Id") ON DELETE CASCADE;


--
-- Name: RoundParticipants FK_RoundParticipants_Users_UserId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."RoundParticipants"
    ADD CONSTRAINT "FK_RoundParticipants_Users_UserId" FOREIGN KEY ("UserId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: ThesisGroups FK_ThesisGroups_ThesisRounds_RoundId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisGroups"
    ADD CONSTRAINT "FK_ThesisGroups_ThesisRounds_RoundId" FOREIGN KEY ("RoundId") REFERENCES public."ThesisRounds"("Id") ON DELETE CASCADE;


--
-- Name: ThesisGroups FK_ThesisGroups_Users_RepresentativeId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisGroups"
    ADD CONSTRAINT "FK_ThesisGroups_Users_RepresentativeId" FOREIGN KEY ("RepresentativeId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: ThesisRounds FK_ThesisRounds_ThesisRounds_CopiedFromId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisRounds"
    ADD CONSTRAINT "FK_ThesisRounds_ThesisRounds_CopiedFromId" FOREIGN KEY ("CopiedFromId") REFERENCES public."ThesisRounds"("Id") ON DELETE SET NULL;


--
-- Name: ThesisTopics FK_ThesisTopics_ThesisGroups_GroupId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisTopics"
    ADD CONSTRAINT "FK_ThesisTopics_ThesisGroups_GroupId" FOREIGN KEY ("GroupId") REFERENCES public."ThesisGroups"("Id") ON DELETE SET NULL;


--
-- Name: ThesisTopics FK_ThesisTopics_ThesisRounds_RoundId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisTopics"
    ADD CONSTRAINT "FK_ThesisTopics_ThesisRounds_RoundId" FOREIGN KEY ("RoundId") REFERENCES public."ThesisRounds"("Id") ON DELETE CASCADE;


--
-- Name: ThesisTopics FK_ThesisTopics_Users_SupervisorId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."ThesisTopics"
    ADD CONSTRAINT "FK_ThesisTopics_Users_SupervisorId" FOREIGN KEY ("SupervisorId") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- Name: TopicHistoryEntries FK_TopicHistoryEntries_ThesisTopics_TopicId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicHistoryEntries"
    ADD CONSTRAINT "FK_TopicHistoryEntries_ThesisTopics_TopicId" FOREIGN KEY ("TopicId") REFERENCES public."ThesisTopics"("Id") ON DELETE CASCADE;


--
-- Name: TopicRegistrations FK_TopicRegistrations_ThesisGroups_GroupId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicRegistrations"
    ADD CONSTRAINT "FK_TopicRegistrations_ThesisGroups_GroupId" FOREIGN KEY ("GroupId") REFERENCES public."ThesisGroups"("Id") ON DELETE CASCADE;


--
-- Name: TopicRegistrations FK_TopicRegistrations_ThesisTopics_TopicId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicRegistrations"
    ADD CONSTRAINT "FK_TopicRegistrations_ThesisTopics_TopicId" FOREIGN KEY ("TopicId") REFERENCES public."ThesisTopics"("Id") ON DELETE CASCADE;


--
-- Name: TopicSubmissions FK_TopicSubmissions_ThesisTopics_TopicId; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicSubmissions"
    ADD CONSTRAINT "FK_TopicSubmissions_ThesisTopics_TopicId" FOREIGN KEY ("TopicId") REFERENCES public."ThesisTopics"("Id") ON DELETE CASCADE;


--
-- Name: TopicSubmissions FK_TopicSubmissions_Users_SubmittedById; Type: FK CONSTRAINT; Schema: public; Owner: se310
--

ALTER TABLE ONLY public."TopicSubmissions"
    ADD CONSTRAINT "FK_TopicSubmissions_Users_SubmittedById" FOREIGN KEY ("SubmittedById") REFERENCES public."Users"("Id") ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict GNOObTmzMaOmHZr7HAbbdd5NglGpQaTfWKAB53dMKSsfc0vcgXgFdLNY4RNppZj

