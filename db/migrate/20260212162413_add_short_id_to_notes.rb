class AddShortIdToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :short_id, :string, limit: 8
    add_index :notes, :short_id, unique: true

    reversible do |dir|
      dir.up do
        Note.find_each do |note|
          note.update_column(:short_id, SecureRandom.alphanumeric(8))
        end
      end
    end
  end
end
