// Lightweight in-memory job tracker for return analysis progress.
// Each job records the real stage the backend is currently executing, so the
// frontend can poll actual status instead of faking a progress bar.
// (For multi-instance production, back this with Redis; the interface stays the same.)

export const ANALYSIS_STAGES = [
    "uploading",
    "vision_analysis",
    "damage_detection",
    "condition_grading",
    "carbon_analysis",
    "buyer_matching",
    "report_generation",
    "completed",
];

const jobs = new Map();

export function createJob(id) {
    const job = {
        id,
        status: "running", // running | completed | failed | needs_more_photos
        stage: "uploading",
        stagesDone: [],
        result: null,
        error: null,
        startedAt: Date.now(),
        updatedAt: Date.now(),
    };
    jobs.set(id, job);
    return job;
}

export function setStage(id, stage) {
    const job = jobs.get(id);
    if (!job) return;
    if (job.stage && !job.stagesDone.includes(job.stage)) job.stagesDone.push(job.stage);
    job.stage = stage;
    job.updatedAt = Date.now();
}

export function completeJob(id, {
    status,
    result,
    error
}) {
    const job = jobs.get(id);
    if (!job) return;
    if (job.stage && !job.stagesDone.includes(job.stage)) job.stagesDone.push(job.stage);
    job.status = status || "completed";
    job.stage = "completed";
    job.result = result || null;
    job.error = error || null;
    job.updatedAt = Date.now();
    // Evict after 10 minutes to avoid unbounded growth.
    const timer = setTimeout(() => jobs.delete(id), 10 * 60 * 1000);
    if (timer.unref) timer.unref();
}

export function getJob(id) {
    return jobs.get(id) || null;
}