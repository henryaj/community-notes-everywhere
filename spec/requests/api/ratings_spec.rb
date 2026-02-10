require "rails_helper"

RSpec.describe "Api::Ratings", type: :request do
  let(:user) { create(:user) }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }
  let(:note) { create(:note) }

  describe "POST /api/notes/:note_id/ratings" do
    it "creates a helpful rating" do
      post "/api/notes/#{note.id}/ratings", params: { helpful: true }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["helpful"]).to be true
      expect(json["note"]["helpful_count"]).to eq(1)
    end

    it "creates a not-helpful rating" do
      post "/api/notes/#{note.id}/ratings", params: { helpful: false }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["helpful"]).to be false
      expect(json["note"]["not_helpful_count"]).to eq(1)
    end

    it "updates an existing rating" do
      create(:rating, user: user, note: note, helpful: true)

      post "/api/notes/#{note.id}/ratings", params: { helpful: false }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(user.ratings.find_by(note: note).helpful).to be false
    end

    it "returns 401 without auth token" do
      post "/api/notes/#{note.id}/ratings", params: { helpful: true }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
