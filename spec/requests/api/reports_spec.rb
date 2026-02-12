require "rails_helper"

RSpec.describe "Api::Reports", type: :request do
  let(:user) { create(:user) }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }
  let(:note) { create(:note) }

  describe "POST /api/notes/:note_id/reports" do
    it "creates a report" do
      post "/api/notes/#{note.id}/reports", params: {
        report: { reason: "spam" }
      }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["reason"]).to eq("spam")
    end

    it "increments the note reports_count" do
      expect {
        post "/api/notes/#{note.id}/reports", params: {
          report: { reason: "harassment" }
        }, headers: auth_headers
      }.to change { note.reload.reports_count }.from(0).to(1)
    end

    it "returns 401 without auth token" do
      post "/api/notes/#{note.id}/reports", params: {
        report: { reason: "spam" }
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 422 when user already reported this note" do
      create(:report, user: user, note: note)

      post "/api/notes/#{note.id}/reports", params: {
        report: { reason: "spam" }
      }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "accepts all valid reason types" do
      %w[spam harassment misleading other].each_with_index do |reason, i|
        reporter = create(:user)
        headers = { "Authorization" => "Bearer #{reporter.auth_token}" }

        post "/api/notes/#{note.id}/reports", params: {
          report: { reason: reason }
        }, headers: headers

        expect(response).to have_http_status(:created), "Expected 201 for reason '#{reason}', got #{response.status}"
      end
    end
  end

  describe "hidden notes filtering" do
    it "excludes notes with 3+ reports from index" do
      page = create(:page, url: "https://example.com/reported")
      hidden_note = create(:note, page: page, reports_count: 3)
      visible_note = create(:note, page: page, reports_count: 2)

      get "/api/notes", params: { url: "https://example.com/reported" }

      json = JSON.parse(response.body)
      note_ids = json["notes"].map { |n| n["id"] }
      expect(note_ids).to include(visible_note.id)
      expect(note_ids).not_to include(hidden_note.id)
    end
  end
end
