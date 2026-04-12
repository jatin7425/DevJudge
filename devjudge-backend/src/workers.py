import azure.functions as func
import json
import logging

from function_app import app
from repository.analysis_jobs import AnalysisJobsRepository
from db.models import JobStatus
from repository.users import UsersRepository
from pipeline.analyse import AnalysisPipeline
from shared.live_logs import send_log
from shared.job_runner import fail_timed_out_jobs


analysis_jobs_repository = AnalysisJobsRepository()
users_repository = UsersRepository()


@app.queue_trigger(
    arg_name="msg",
    queue_name="analysis-queue",
    connection="AzureWebJobsStorage"
)
def run_analysis_worker(msg: func.QueueMessage):

    try:
        data = json.loads(msg.get_body().decode())

        job_id = data["job_id"]
        username = data["username"]

        send_log(job_id, f"Worker started for {username}", progress=12, status="running")

        # 1. Get user
        user = users_repository.get_user_by_username(username)
        if user is None:
            raise RuntimeError("User not found")

        # 2. Mark as running
        analysis_jobs_repository.update_status(job_id, JobStatus.RUNNING)

        send_log(job_id, "Pipeline execution started", progress=18, status="running")

        # 3. Run pipeline
        pipeline = AnalysisPipeline(job_id, user)
        result = pipeline.trigger()

        send_log(job_id, "Pipeline execution completed", progress=100, status="running")

        # 4. Mark as completed
        analysis_jobs_repository.update_status(
            job_id,
            JobStatus.COMPLETED,
            result=result
        )
        users_repository.mark_initial_analysis_completed(username)

        send_log(job_id, "Job completed successfully", progress=100, status="completed")

    except Exception as e:
        logging.exception("Worker failed")

        job_id = data.get("job_id") if "data" in locals() else None

        if job_id:
            analysis_jobs_repository.update_status(
                job_id,
                JobStatus.FAILED,
                error=str(e)
            )
            if "username" in locals():
                users_repository.mark_initial_analysis_failed(username)

            send_log(job_id, f"Job failed: {str(e)}", status="failed")


@app.timer_trigger(
    schedule="0 */20 * * * *",
    arg_name="timer",
    run_on_startup=False,
    use_monitor=True
)
def cleanup_timed_out_jobs_worker(timer: func.TimerRequest):
    logging.info("Starting scheduled cleanup for timed-out jobs.")
    
    count = fail_timed_out_jobs(timeout_minutes=20)
    
    if count > 0:
        logging.info(f"Successfully timed out {count} stalled jobs.")
