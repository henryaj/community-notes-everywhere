require "rails_helper"

RSpec.describe Note, type: :model do
  describe "#generate_short_id" do
    it "generates an 8-character short_id on create" do
      note = create(:note)
      expect(note.short_id).to be_present
      expect(note.short_id.length).to eq(8)
      expect(note.short_id).to match(/\A[a-zA-Z0-9]+\z/)
    end

    it "generates unique short_ids" do
      notes = Array.new(10) { create(:note) }
      short_ids = notes.map(&:short_id)
      expect(short_ids.uniq.length).to eq(10)
    end
  end

  describe "#short_url" do
    it "returns the short URL path" do
      note = create(:note)
      expect(note.short_url).to eq("/n/#{note.short_id}")
    end
  end

  describe "#transparency_data" do
    it "returns transparency metrics" do
      note = build(:note, helpful_count: 4, somewhat_count: 1, not_helpful_count: 1)
      data = note.transparency_data

      expect(data[:positive_count]).to eq(5)
      expect(data[:total_ratings]).to eq(6)
      expect(data[:min_positive_needed]).to eq(3)
      expect(data[:meets_positive_threshold]).to be true
      expect(data[:meets_helpful_ratio]).to be true
      expect(data[:positive_progress]).to eq(3)
    end

    it "returns unmet thresholds for new notes" do
      note = build(:note, helpful_count: 1, somewhat_count: 0, not_helpful_count: 0)
      data = note.transparency_data

      expect(data[:positive_count]).to eq(1)
      expect(data[:meets_positive_threshold]).to be false
      expect(data[:positive_progress]).to eq(1)
    end

    it "calculates not_helpful metrics correctly" do
      note = build(:note, helpful_count: 0, somewhat_count: 0, not_helpful_count: 4)
      data = note.transparency_data

      expect(data[:meets_not_helpful_threshold]).to be true
      expect(data[:meets_not_helpful_ratio]).to be true
      expect(data[:negative_progress]).to eq(3)
    end
  end

  describe "#record_status_change!" do
    it "creates a status change record" do
      note = create(:note, helpful_count: 3, somewhat_count: 0, not_helpful_count: 0)

      expect {
        note.record_status_change!("pending", "helpful", "rating")
      }.to change(NoteStatusChange, :count).by(1)

      change = note.note_status_changes.last
      expect(change.from_status).to eq(0)
      expect(change.to_status).to eq(1)
      expect(change.helpful_count_at_change).to eq(3)
      expect(change.trigger).to eq("rating")
    end
  end

  describe "#update_status!" do
    it "creates a status change record when transitioning to helpful" do
      note = create(:note, helpful_count: 3, somewhat_count: 0, not_helpful_count: 0, status: :pending)

      expect {
        note.update_status!
      }.to change(NoteStatusChange, :count).by(1)

      expect(note.reload.status).to eq("helpful")
      change = note.note_status_changes.last
      expect(change.from_status_name).to eq("pending")
      expect(change.to_status_name).to eq("helpful")
    end

    it "triggers rating impact recalculation for raters" do
      note = create(:note, helpful_count: 3, somewhat_count: 0, not_helpful_count: 0, status: :pending)
      rater = create(:user, reputation_score: 20.0)
      create(:rating, user: rater, note: note, helpfulness: :yes)

      # Reload to pick up counter cache changes
      note.reload
      note.update_column(:helpful_count, 3)
      note.update_status!

      rater.reload
      expect(rater.rating_impact).to be >= 0
    end

    it "does not create a status change when status does not change" do
      note = create(:note, helpful_count: 1, somewhat_count: 0, not_helpful_count: 0, status: :pending)

      expect {
        note.update_status!
      }.not_to change(NoteStatusChange, :count)
    end
  end
end
