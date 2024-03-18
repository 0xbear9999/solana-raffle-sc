import { ArrowUpTrayIcon, DocumentIcon } from "@heroicons/react/24/outline"
import { Button, Input, cn } from "@nextui-org/react"
import { Dispatch, SetStateAction, useState } from "react"
import { useDropzone } from "react-dropzone"
import toast from "react-hot-toast"

export function ImageUpload({
  label,
  className = "",
  file,
  setFile,
  initial,
  onClear,
}: {
  label: string
  className?: string
  file: File | null
  setFile: Dispatch<SetStateAction<File | null>>
  initial?: string | null
  onClear: Function
}) {
  function onDrop(files: File[]) {
    if (!files.length) {
      toast.error("Invalid file")
    }
    if (files.length > 1) {
      toast.error("Only one file can be uploaded at a time")
    } else {
      setFile(files[0])
    }
  }

  const { getRootProps, getInputProps, isDragActive, isFocused, isDragAccept, isDragReject, open } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 5e6,
    autoFocus: false,
    noClick: true,
    noDragEventsBubbling: true,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/svg+xml": [],
      "image/webp": [],
      "image/gif": [],
    },
  })

  return (
    <div className={cn(className, "flex flex-col gap-1")}>
      <label data-slot="label" className="pl-3 pb-1">
        {label}
      </label>
      <div
        {...getRootProps()}
        className={cn(
          "w-full aspect-video bg-content2 rounded-xl hover:bg-content3 cursor-pointer flex items-center justify-center relative",
          {
            "bg-content3": isDragActive,
            "border-2": isDragAccept || isDragReject,
            "border-red-700": isDragReject,
            "border-green-500": isDragAccept,
          }
        )}
        onClick={open}
      >
        {file ? (
          <img src={URL.createObjectURL(file)} className="max-h-full max-w-full p-5" />
        ) : initial ? (
          <img src={`https://arweave.net/${initial}`} className="max-h-full max-w-full p-5" />
        ) : (
          <ArrowUpTrayIcon className="w-8" />
        )}

        {(file || initial) && (
          <span
            role="button"
            tabIndex={0}
            data-slot="clear-button"
            className="p-2 -m-2 z-10 absolute right-3 appearance-none select-none hover:!opacity-100 cursor-pointer active:!opacity-70 rounded-full outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 text-large peer-data-[filled=true]:opacity-70 block transition-opacity motion-reduce:transition-none"
            data-dashlane-label="true"
            data-dashlane-rid="7d6d437963230c39"
            data-form-type="other"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClear()
            }}
          >
            <svg aria-hidden="true" focusable="false" height="1em" role="presentation" viewBox="0 0 24 24" width="1em">
              <path
                d="M12 2a10 10 0 1010 10A10.016 10.016 0 0012 2zm3.36 12.3a.754.754 0 010 1.06.748.748 0 01-1.06 0l-2.3-2.3-2.3 2.3a.748.748 0 01-1.06 0 .754.754 0 010-1.06l2.3-2.3-2.3-2.3A.75.75 0 019.7 8.64l2.3 2.3 2.3-2.3a.75.75 0 011.06 1.06l-2.3 2.3z"
                fill="currentColor"
              ></path>
            </svg>
          </span>
        )}

        <input {...getInputProps()} />
      </div>
    </div>
  )
}
