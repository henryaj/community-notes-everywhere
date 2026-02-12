class CreateNoteStatusChanges < ActiveRecord::Migration[8.1]
  def change
    create_table :note_status_changes do |t|
      t.references :note, null: false, foreign_key: true
      t.integer :from_status, null: false
      t.integer :to_status, null: false
      t.integer :helpful_count_at_change
      t.integer :somewhat_count_at_change
      t.integer :not_helpful_count_at_change
      t.string :trigger
      t.datetime :created_at, null: false
    end
  end
end
