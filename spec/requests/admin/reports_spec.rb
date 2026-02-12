require "rails_helper"

RSpec.describe "Admin::Reports", type: :request do
  let(:admin) { create(:user, :admin, reputation_score: 50.0) }
  let(:regular_user) { create(:user, reputation_score: 30.0) }
  let(:admin_headers) { { "Authorization" => "Bearer #{admin.auth_token}" } }
  let(:user_headers) { { "Authorization" => "Bearer #{regular_user.auth_token}" } }

  describe "GET /admin/reports" do
    it "allows admin to list reports" do
      report = create(:report)
      get "/admin/reports", headers: admin_headers
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(report.user.twitter_handle)
    end

    it "returns 403 for regular users" do
      get "/admin/reports", headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /admin/reports/:id" do
    let(:note) { create(:note, reports_count: 2) }
    let!(:report) { create(:report, note: note) }

    it "dismisses a report by resetting reports_count" do
      patch "/admin/reports/#{report.id}", params: { action_taken: "dismiss" }, headers: admin_headers
      expect(response).to redirect_to(admin_reports_path)
      expect(note.reload.reports_count).to eq(0)
    end

    it "removes a reported note" do
      patch "/admin/reports/#{report.id}", params: { action_taken: "remove" }, headers: admin_headers
      expect(response).to redirect_to(admin_reports_path)
      expect(Note.find_by(id: note.id)).to be_nil
    end
  end
end
