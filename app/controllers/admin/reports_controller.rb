module Admin
  class ReportsController < BaseController
    layout "pages"

    def index
      @reports = Report.includes(note: :author, user: []).order(created_at: :desc)
    end

    def update
      report = Report.find(params[:id])
      note = report.note
      if params[:action_taken] == "dismiss"
        note.update_column(:reports_count, 0)
      elsif params[:action_taken] == "remove"
        note.destroy!
      end
      redirect_to admin_reports_path
    end
  end
end
