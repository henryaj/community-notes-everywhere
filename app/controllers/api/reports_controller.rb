module Api
  class ReportsController < ApplicationController
    before_action :authenticate!

    # POST /api/notes/:note_id/reports
    def create
      note = Note.find(params[:note_id])
      report = note.reports.build(user: current_user, reason: report_params[:reason])

      if report.save
        render json: { id: report.id, reason: report.reason }, status: :created
      else
        render json: { errors: report.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def report_params
      params.require(:report).permit(:reason)
    end
  end
end
