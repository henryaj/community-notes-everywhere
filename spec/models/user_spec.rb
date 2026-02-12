require "rails_helper"

RSpec.describe User, type: :model do
  describe "#public_notes" do
    it "returns notes with fewer than 3 reports" do
      user = create(:user)
      visible_note = create(:note, author: user, reports_count: 0)
      reported_note = create(:note, author: user, reports_count: 3)

      expect(user.public_notes).to include(visible_note)
      expect(user.public_notes).not_to include(reported_note)
    end

    it "orders by created_at desc" do
      user = create(:user)
      older = create(:note, author: user, created_at: 2.days.ago)
      newer = create(:note, author: user, created_at: 1.day.ago)

      expect(user.public_notes).to eq([newer, older])
    end
  end

  describe "#profile_stats" do
    it "returns counts of notes by status" do
      user = create(:user)
      create(:note, author: user, status: :pending)
      create(:note, author: user, status: :helpful)
      create(:note, author: user, status: :helpful)
      create(:note, author: user, status: :not_helpful)

      stats = user.profile_stats
      expect(stats[:total_notes]).to eq(4)
      expect(stats[:helpful_count]).to eq(2)
      expect(stats[:not_helpful_count]).to eq(1)
      expect(stats[:pending_count]).to eq(1)
    end
  end

  describe "#recalculate_rating_impact!" do
    it "sets impact to 0 when user has no ratings on decided notes" do
      user = create(:user)
      user.recalculate_rating_impact!
      expect(user.rating_impact).to eq(0.0)
    end

    it "calculates impact based on consensus count" do
      user = create(:user, reputation_score: 20.0)
      note = create(:note, status: :helpful, helpful_count: 3)
      create(:rating, user: user, note: note, helpfulness: :yes)

      user.recalculate_rating_impact!
      expect(user.rating_impact).to be >= 0.7
    end
  end
end
