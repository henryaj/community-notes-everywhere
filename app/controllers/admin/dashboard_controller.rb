module Admin
  class DashboardController < BaseController
    layout "pages"

    def index
      @total_users = User.count
      @total_notes = Note.count
      @flagged_notes = Note.where("reports_count > 0").count
      @hidden_notes = Note.where("reports_count >= 3").count
      @recent_reports = Report.includes(note: :author, user: []).order(created_at: :desc).limit(20)
      @is_superadmin = current_user.superadmin?
    end
  end
end
