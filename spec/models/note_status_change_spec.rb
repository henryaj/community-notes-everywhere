require "rails_helper"

RSpec.describe NoteStatusChange, type: :model do
  describe "associations" do
    it "belongs to a note" do
      assoc = described_class.reflect_on_association(:note)
      expect(assoc.macro).to eq(:belongs_to)
    end
  end

  describe "#from_status_name" do
    it "returns the human-readable status name" do
      change = build(:note_status_change, from_status: 0)
      expect(change.from_status_name).to eq("pending")
    end

    it "returns helpful for status 1" do
      change = build(:note_status_change, from_status: 1)
      expect(change.from_status_name).to eq("helpful")
    end
  end

  describe "#to_status_name" do
    it "returns the human-readable status name" do
      change = build(:note_status_change, to_status: 1)
      expect(change.to_status_name).to eq("helpful")
    end

    it "returns not_helpful for status 2" do
      change = build(:note_status_change, to_status: 2)
      expect(change.to_status_name).to eq("not_helpful")
    end
  end
end
