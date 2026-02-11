require "rails_helper"

RSpec.describe "Api::Ratings", type: :request do
  let(:user) { create(:user) }
  let(:auth_headers) { { "Authorization" => "Bearer #{user.auth_token}" } }
  let(:note) { create(:note) }

  describe "POST /api/notes/:note_id/ratings" do
    it "creates a 'yes' rating" do
      post "/api/notes/#{note.id}/ratings", params: { helpfulness: "yes" }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["helpfulness"]).to eq("yes")
      expect(json["note"]["helpful_count"]).to eq(1)
      expect(json["note"]["somewhat_count"]).to eq(0)
      expect(json["note"]["not_helpful_count"]).to eq(0)
    end

    it "creates a 'somewhat' rating" do
      post "/api/notes/#{note.id}/ratings", params: { helpfulness: "somewhat" }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["helpfulness"]).to eq("somewhat")
      expect(json["note"]["somewhat_count"]).to eq(1)
      expect(json["note"]["helpful_count"]).to eq(0)
    end

    it "creates a 'no' rating" do
      post "/api/notes/#{note.id}/ratings", params: { helpfulness: "no" }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["helpfulness"]).to eq("no")
      expect(json["note"]["not_helpful_count"]).to eq(1)
    end

    it "updates an existing rating" do
      create(:rating, user: user, note: note, helpfulness: :yes)

      post "/api/notes/#{note.id}/ratings", params: { helpfulness: "no" }, headers: auth_headers

      expect(response).to have_http_status(:ok)
      expect(user.ratings.find_by(note: note).helpfulness).to eq("no")
    end

    it "returns 401 without auth token" do
      post "/api/notes/#{note.id}/ratings", params: { helpfulness: "yes" }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
