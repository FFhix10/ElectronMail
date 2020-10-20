import path from "path";
import {pick} from "remeda";
import {platform} from "os";

import {CONSOLE_LOG, execShell, fetchUrl} from "scripts/lib";
import {CWD_ABSOLUTE_DIR} from "scripts/const";

// process.env.APPVEYOR_ACCOUNT_NAME = "vladimiry";
// process.env.APPVEYOR_PROJECT_SLUG = "electronmail";
// process.env.LINUX_JOB_ARTIFACT_TAR = "webclients-artifact.tar";
// process.env.LINUX_JOB_NAME = "image: Ubuntu1804";

const {
    APPVEYOR_ACCOUNT_NAME = "",
    APPVEYOR_PROJECT_SLUG = "",
    LINUX_JOB_ARTIFACT_TAR = "",
    LINUX_JOB_NAME = "",
} = process.env;

CONSOLE_LOG(
    JSON.stringify({
        APPVEYOR_ACCOUNT_NAME,
        APPVEYOR_PROJECT_SLUG,
        LINUX_JOB_ARTIFACT_TAR,
        LINUX_JOB_NAME,
    }),
);

if (
    !APPVEYOR_ACCOUNT_NAME
    ||
    !APPVEYOR_PROJECT_SLUG
    ||
    !LINUX_JOB_ARTIFACT_TAR
    ||
    !LINUX_JOB_NAME
) {
    throw new Error(`Some environment variables have not been set`);
}

interface Job {
    jobId: string;
    name: string;
    status: "success" | unknown;
}

(async () => {
    const projectResponse = await fetchUrl([
        `https://ci.appveyor.com/api/projects/${APPVEYOR_ACCOUNT_NAME}/${APPVEYOR_PROJECT_SLUG}`,
        {headers: {"Content-type": "application/json"}},
    ]);
    const {build: {jobs}} = await projectResponse.json() as { build: { jobs: Job[] } };
    const job = jobs.find(({name}) => name.toLocaleLowerCase() === LINUX_JOB_NAME.toLocaleLowerCase());

    if (!job) {
        throw new Error(`Failed to resolve web clients preparing job (${JSON.stringify({name: JSON.stringify(LINUX_JOB_NAME)})})`);
    }
    if (job.status !== "success") {
        throw new Error(`Invalid web clients preparing job status (${JSON.stringify(pick(job, ["name", "jobId", "status"]))})`);
    }

    const tarFile = path.join(CWD_ABSOLUTE_DIR, LINUX_JOB_ARTIFACT_TAR);

    await execShell([
        "curl",
        [
            "--location", // following redirects
            "--silent", // no progress
            `https://ci.appveyor.com/api/buildjobs/${job.jobId}/artifacts/${LINUX_JOB_ARTIFACT_TAR}`,
            "--output",
            tarFile,
        ],
    ]);

    if (platform() === "win32") {
        await execShell(["7z", ["x", tarFile]]);
    } else {
        await execShell(["tar", ["-xf", tarFile]]);
    }
})().catch((error) => {
    CONSOLE_LOG(error);
    process.exit(1);
});